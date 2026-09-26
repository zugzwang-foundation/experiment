import { RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import { type EnvironmentConfig, taskRoleNames } from "../config/types";

export interface SecurityStackProps extends StackProps {
	readonly config: EnvironmentConfig;
}

/**
 * The image registry, the secret reference and the two IAM roles.
 *
 * ⛔ NO SECRET VALUE IS DEFINED HERE, and that is deliberate. Doppler stays the
 * source of truth; the Secrets Manager secret is created and populated out of
 * band, and CDK only references it by name. So a `cdk synth` artifact never
 * contains a credential, and rotating one needs no deploy.
 */
export class SecurityStack extends Stack {
	public readonly repository: ecr.IRepository;
	public readonly appSecret: secretsmanager.ISecret;
	public readonly executionRole: iam.Role;
	public readonly taskRole: iam.Role;
	/**
	 * ⚠ The log group lives HERE, not in the compute stack, and that is a
	 * structural fix rather than a preference. `LogDrivers.awsLogs` grants the
	 * execution role write access to the group; with the group in compute and
	 * the role here, the two stacks reference each other and CDK refuses the
	 * cycle. Identity and its targets belong together.
	 */
	public readonly logGroup: logs.LogGroup;

	constructor(scope: Construct, id: string, props: SecurityStackProps) {
		super(scope, id, props);
		const { config } = props;

		this.repository = new ecr.Repository(this, "Repository", {
			repositoryName: config.ecrRepositoryName,
			imageScanOnPush: true,
			// Images are environment-specific (ZUGZWANG_ENV is baked in at build
			// time), so a tag is never promoted between environments — the tag
			// history here is this environment's deploy history.
			lifecycleRules: [{ maxImageCount: 20 }],
			removalPolicy: RemovalPolicy.RETAIN,
			emptyOnDelete: false,
		});

		this.logGroup = new logs.LogGroup(this, "AppLogs", {
			logGroupName: `/zugzwang/${config.name}/app`,
			retention: config.logRetentionDays as logs.RetentionDays,
			removalPolicy: RemovalPolicy.RETAIN,
		});

		this.appSecret = secretsmanager.Secret.fromSecretNameV2(
			this,
			"AppSecret",
			config.secretName,
		);

		// Pulls the image, writes logs, reads exactly one secret.
		// ⚠ EXPLICIT NAMES (production-readiness review, HIGH-4): the GitHub deploy
		// role's `iam:PassRole` must name these exactly. CloudFormation-generated
		// names hit IAM's 64-char ceiling — staging's is exactly 64 and
		// `Zugzwang-production-Security-` is 3 chars longer, so the stack prefix
		// would be truncated and any prefix pattern would match nothing. Both
		// names are exported via `taskRoleNames` in config/types.ts.
		this.executionRole = new iam.Role(this, "TaskExecutionRole", {
			roleName: taskRoleNames(config.name).execution,
			assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
			description: `Zugzwang ${config.name} task execution role`,
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					"service-role/AmazonECSTaskExecutionRolePolicy",
				),
			],
		});
		this.repository.grantPull(this.executionRole);
		this.appSecret.grantRead(this.executionRole);
		this.logGroup.grantWrite(this.executionRole);

		// ⛔ THE APPLICATION'S OWN ROLE HOLDS NO AWS PERMISSIONS, and that is the
		// least-privilege statement worth making explicitly: the app stores files
		// in Cloudflare R2, caches in Upstash and queries Supabase — none of which
		// are AWS APIs. If a future feature needs an AWS call, it is added here
		// deliberately rather than inherited.
		this.taskRole = new iam.Role(this, "TaskRole", {
			roleName: taskRoleNames(config.name).task,
			assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
			description: `Zugzwang ${config.name} task role (no AWS permissions)`,
		});
	}
}
