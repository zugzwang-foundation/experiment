import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { taskRoleNames } from "../config/types";

export interface DeployStackProps extends StackProps {
	/** `owner/repo`, e.g. `zugzwang-foundation/experiment`. */
	readonly githubRepository: string;
	/**
	 * Environments whose GitHub `environment:` may deploy: one role each, bound
	 * to THAT environment's CDK bootstrap qualifier (H-3).
	 */
	readonly environments: readonly {
		readonly name: string;
		readonly bootstrapQualifier: string;
	}[];
	/**
	 * The account's EXISTING GitHub OIDC provider ARN, when one exists. The
	 * provider is an account-level singleton — creating a second one fails with
	 * `EntityAlreadyExists` (`@code-reviewer` MEDIUM) — so an account that has
	 * ever used GitHub OIDC imports it here and only the roles are created.
	 */
	readonly existingOidcProviderArn?: string;
}

/**
 * What `deploy-aws.yml` assumes (AWS-MIGRATION-3). ONE stack for the account,
 * not one per environment: the GitHub OIDC provider is an account-level
 * singleton, and a role per environment hangs off it.
 *
 * ⛔ SYNTH-ONLY UNTIL APPROVED. Nothing deploys this by default; it is here so
 * the diff can be read before the first GitHub-driven deploy of staging.
 *
 * The roles are deliberately narrow. `cdk deploy` does its real work through
 * the CDK bootstrap roles (`cdk-hnb659fds-{deploy,file-publishing,
 * image-publishing,lookup}-role-<account>-<region>`), so the GitHub role only
 * needs to ASSUME those, push to ECR, and read ECS state for the
 * `services-stable` wait. It carries no `iam:PassRole`, no CloudFormation
 * rights of its own and no access to the app secrets — the CloudFormation
 * execution role holds those.
 *
 * ⚠ H-3 (`@security-auditor`). The trust policy bounds WHO may assume a role;
 * the bootstrap roles it assumes bound what it can do. Each environment role
 * now assumes ONLY its own environment's bootstrap roles (per-environment
 * qualifier: staging `hnb659fds`, production `zzprod`), so a staging token
 * cannot assume production's bootstrap roles. ⚠ That is NOT yet "a staging
 * token cannot reach production" (review HIGH-3): staging's default-bootstrap
 * deploy role still has CloudFormation rights on every stack name — including
 * `Zugzwang-production-*` AND this `Zugzwang-Deploy` stack, whose production
 * role it could rewrite. Closing that needs an explicit deny on that bootstrap
 * role, and scoping each execution policy below AdministratorAccess — the
 * bootstrap runbook in docs/aws-migration/09-PRODUCTION-READINESS.md §B.
 *
 * Trust is pinned to `repo:<owner/repo>:environment:<name>`: a token minted
 * for the `staging` environment cannot assume the production role, and a
 * GitHub environment can require a reviewer before it mints one at all.
 */
export class DeployStack extends Stack {
	constructor(scope: Construct, id: string, props: DeployStackProps) {
		super(scope, id, props);

		const provider = props.existingOidcProviderArn
			? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
					this,
					"GitHubOidc",
					props.existingOidcProviderArn,
				)
			: new iam.OpenIdConnectProvider(this, "GitHubOidc", {
					url: "https://token.actions.githubusercontent.com",
					clientIds: ["sts.amazonaws.com"],
				});

		for (const {
			name: environment,
			bootstrapQualifier,
		} of props.environments) {
			const bootstrapRoles = [
				"deploy-role",
				"file-publishing-role",
				"image-publishing-role",
				"lookup-role",
			].map(
				(name) =>
					`arn:aws:iam::${this.account}:role/cdk-${bootstrapQualifier}-${name}-${this.account}-${this.region}`,
			);
			const role = new iam.Role(this, `Deploy-${environment}`, {
				roleName: `zugzwang-${environment}-github-deploy`,
				// ASCII only: CloudFormation rejects non-ASCII in IAM descriptions
				// (the RDS parameter-group lesson, database-stack.ts).
				description: `deploy-aws.yml (${environment}) - assumes the CDK bootstrap roles, pushes to ECR, waits on ECS`,
				assumedBy: new iam.WebIdentityPrincipal(
					provider.openIdConnectProviderArn,
					{
						StringEquals: {
							"token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
							"token.actions.githubusercontent.com:sub": `repo:${props.githubRepository}:environment:${environment}`,
						},
					},
				),
			});
			role.addToPolicy(
				new iam.PolicyStatement({
					sid: "AssumeCdkBootstrapRoles",
					actions: ["sts:AssumeRole"],
					resources: bootstrapRoles,
				}),
			);
			role.addToPolicy(
				new iam.PolicyStatement({
					sid: "EcrLogin",
					actions: ["ecr:GetAuthorizationToken"],
					resources: ["*"],
				}),
			);
			role.addToPolicy(
				new iam.PolicyStatement({
					sid: "EcrPush",
					actions: [
						"ecr:BatchCheckLayerAvailability",
						"ecr:CompleteLayerUpload",
						"ecr:InitiateLayerUpload",
						"ecr:PutImage",
						"ecr:UploadLayerPart",
						"ecr:BatchGetImage",
						"ecr:GetDownloadUrlForLayer",
						"ecr:DescribeImages",
					],
					resources: [
						`arn:aws:ecr:${this.region}:${this.account}:repository/zugzwang-${environment}`,
					],
				}),
			);
			// `ecs:cluster` is a condition key for DescribeServices; ListServices
			// carries no condition keys, so a conditioned statement would never
			// allow it and the workflow's `services-stable` wait would 403 on its
			// first real run (`@security-auditor` M-5). Split the two.
			role.addToPolicy(
				new iam.PolicyStatement({
					sid: "EcsDescribe",
					actions: ["ecs:DescribeServices"],
					resources: ["*"],
					conditions: {
						ArnLike: {
							"ecs:cluster": `arn:aws:ecs:${this.region}:${this.account}:cluster/zugzwang-${environment}`,
						},
					},
				}),
			);
			role.addToPolicy(
				new iam.PolicyStatement({
					sid: "EcsList",
					actions: ["ecs:ListServices"],
					resources: ["*"],
				}),
			);
			// D — migrations run INSIDE the VPC as a one-off ECS task (RDS is
			// private; a GitHub runner cannot reach it). The role may start only
			// this environment's migration family, on this environment's cluster,
			// and pass only this environment's task roles to ECS.
			const clusterArn = `arn:aws:ecs:${this.region}:${this.account}:cluster/zugzwang-${environment}`;
			role.addToPolicy(
				new iam.PolicyStatement({
					sid: "RunMigrationTask",
					actions: ["ecs:RunTask"],
					resources: [
						`arn:aws:ecs:${this.region}:${this.account}:task-definition/zugzwang-${environment}-migrate:*`,
					],
					conditions: { ArnEquals: { "ecs:cluster": clusterArn } },
				}),
			);
			role.addToPolicy(
				new iam.PolicyStatement({
					sid: "WatchMigrationTask",
					actions: ["ecs:DescribeTasks"],
					resources: [
						`arn:aws:ecs:${this.region}:${this.account}:task/zugzwang-${environment}/*`,
					],
				}),
			);
			role.addToPolicy(
				new iam.PolicyStatement({
					sid: "PassTaskRoles",
					actions: ["iam:PassRole"],
					// Exact ARNs (review HIGH-4): a prefix pattern would miss the
					// truncated CloudFormation-generated names in production.
					resources: [
						taskRoleNames(environment).execution,
						taskRoleNames(environment).task,
					].map((name) => `arn:aws:iam::${this.account}:role/${name}`),
					conditions: {
						StringEquals: { "iam:PassedToService": "ecs-tasks.amazonaws.com" },
					},
				}),
			);
			role.addToPolicy(
				new iam.PolicyStatement({
					sid: "ReadComputeOutputs",
					actions: ["cloudformation:DescribeStacks"],
					resources: [
						`arn:aws:cloudformation:${this.region}:${this.account}:stack/Zugzwang-${environment}-Compute/*`,
					],
				}),
			);
			new CfnOutput(this, `DeployRoleArn-${environment}`, {
				value: role.roleArn,
				description: `AWS_DEPLOY_ROLE_ARN for the GitHub "${environment}" environment`,
			});
		}
	}
}
