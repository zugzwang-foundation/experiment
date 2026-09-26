import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import type * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import type * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import type * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../config/types";

export interface ComputeStackProps extends StackProps {
	readonly config: EnvironmentConfig;
	readonly vpc: ec2.IVpc;
	readonly albSecurityGroup: ec2.ISecurityGroup;
	readonly serviceSecurityGroup: ec2.ISecurityGroup;
	readonly serviceSubnets: ec2.SubnetSelection;
	readonly repository: ecr.IRepository;
	readonly appSecret: secretsmanager.ISecret;
	readonly executionRole: iam.IRole;
	readonly taskRole: iam.IRole;
	/** Created in the security stack, beside the role that writes to it. */
	readonly logGroup: logs.ILogGroup;
}

/**
 * The application: an ECS service on EC2 instances behind an ALB, plus a
 * one-off task definition for migrations.
 *
 * ⚠ ECS ON EC2 RATHER THAN FARGATE, by decision: the team wants to own the
 * machines. What that changes is the CAPACITY underneath — an Auto Scaling
 * Group and a capacity provider — and nothing else. The task definition, the
 * rolling deploy with automatic rollback, the health checks, the migration
 * task, the secrets and the alarms are identical either way, which is the
 * whole reason the switch is one file.
 *
 * ⚠ THE awsvpc NETWORK MODE IS KEPT. It gives each task its own network
 * interface, so the task security group still means what it says and the ALB
 * still targets IPs rather than host ports. Bridge mode would put every task
 * on the host's network and quietly widen what that security group covers.
 */
export class ComputeStack extends Stack {
	public readonly service: ecs.Ec2Service;
	public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
	public readonly targetGroup: elbv2.ApplicationTargetGroup;
	public readonly logGroup: logs.ILogGroup;
	public readonly migrationTaskDefinition: ecs.Ec2TaskDefinition;
	/** The EC2 capacity behind the cluster. Exposed for host-level alarms. */
	public readonly autoScalingGroup: autoscaling.AutoScalingGroup;

	constructor(scope: Construct, id: string, props: ComputeStackProps) {
		super(scope, id, props);
		const { config } = props;

		// The image tag CI just pushed. `-c imageTag=<sha>` overrides the default
		// so a deploy pins an exact build rather than a moving `latest`.
		const imageTag =
			(this.node.tryGetContext("imageTag") as string | undefined) ??
			config.imageTag;

		this.logGroup = props.logGroup;

		const cluster = new ecs.Cluster(this, "Cluster", {
			vpc: props.vpc,
			clusterName: `zugzwang-${config.name}`,
			containerInsightsV2: ecs.ContainerInsights.ENABLED,
		});

		// ⚠ THE INSTANCE ROLE IS CREATED HERE, NOT IN THE SECURITY STACK, and the
		// reason is the same one that moved the log group: joining a cluster grants
		// the role permissions SCOPED TO THAT CLUSTER, so a role defined in another
		// stack makes the two reference each other and CDK refuses the cycle. An
		// identity lives with the thing it is scoped to.
		const instanceRole = new iam.Role(this, "InstanceRole", {
			assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
			description: `Zugzwang ${config.name} ECS container instance role`,
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					"service-role/AmazonEC2ContainerServiceforEC2Role",
				),
				// Session Manager instead of SSH: no key pairs, no open port 22, and
				// every session is logged.
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					"AmazonSSMManagedInstanceCore",
				),
			],
		});

		// ── EC2 capacity ────────────────────────────────────────────────────────
		// The ECS-optimised AMI ships the agent and Docker already configured;
		// building our own image would mean owning that patch cycle for no gain.
		this.autoScalingGroup = new autoscaling.AutoScalingGroup(this, "Capacity", {
			vpc: props.vpc,
			vpcSubnets: props.serviceSubnets,
			instanceType: new ec2.InstanceType(config.instanceType),
			machineImage: ecs.EcsOptimizedImage.amazonLinux2023(),
			role: instanceRole,
			securityGroup: props.serviceSecurityGroup,
			minCapacity: config.minInstances,
			maxCapacity: config.maxInstances,
			// An instance is replaced rather than patched in place: a new AMI means
			// a new launch template version and a rolling replacement.
			// minInstancesInService: 1 — the default (0) terminated the only host
			// before its replacement existed and staging served 503 for the whole
			// window (06-STAGING-DEPLOYMENT.md §10.4). Needs maxInstances >= 2.
			updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
				minInstancesInService: 1,
				maxBatchSize: 1,
			}),
			requireImdsv2: true,
		});

		const capacityProvider = new ecs.AsgCapacityProvider(this, "AsgCapacity", {
			autoScalingGroup: this.autoScalingGroup,
			// ECS adds an instance when a deploy needs room for the new task and
			// removes it afterwards, so a rolling deploy never has to fit two tasks
			// onto one box that cannot hold them.
			enableManagedScaling: true,
			targetCapacityPercent: 100,
			// Drains the instance before termination, so in-flight requests and the
			// deferred after() work are not cut off mid-flight.
			enableManagedDraining: true,
			enableManagedTerminationProtection: false,
		});
		cluster.addAsgCapacityProvider(capacityProvider);

		// ── The app task ────────────────────────────────────────────────────────
		const taskDefinition = new ecs.Ec2TaskDefinition(this, "AppTask", {
			networkMode: ecs.NetworkMode.AWS_VPC,
			executionRole: props.executionRole,
			taskRole: props.taskRole,
		});

		const secrets = Object.fromEntries(
			config.secretKeys.map((key) => [
				key,
				ecs.Secret.fromSecretsManager(props.appSecret, key),
			]),
		);

		/**
		 * ⚠ `APP_COMMIT_SHA` and `APP_REGION` replace Vercel's
		 * `VERCEL_GIT_COMMIT_SHA` / `VERCEL_REGION`, which `/api/health` reads
		 * today. Until the route falls back to these names, `canary` is `null` off
		 * Vercel and the deploy gate ("canary equals the pushed SHA") silently
		 * stops working — see docs/reports/AWS-CDK-DESIGN.md finding A2.
		 */
		const environment: Record<string, string> = {
			NODE_ENV: "production",
			PORT: String(config.containerPort),
			HOSTNAME: "0.0.0.0",
			ZUGZWANG_ENV: config.zugzwangEnv,
			APP_COMMIT_SHA: imageTag,
			APP_REGION: config.region,
			// Production refuses transaction mode in code (ADR-0024 P3 #8); the
			// session pooler is also what the pool settings in src/db/index.ts
			// were tuned against.
			DB_POOLER_MODE: "session",
			// AWS-MIGRATION-3 — see the fields' docblocks in config/types.ts.
			NODE_OPTIONS: `--max-old-space-size=${config.nodeMaxOldSpaceMiB}`,
			KEEP_ALIVE_TIMEOUT: String(config.keepAliveTimeoutMs),
			...(config.writesPaused ? { ZUGZWANG_WRITES_PAUSED: "paused" } : {}),
		};

		const container = taskDefinition.addContainer("app", {
			image: ecs.ContainerImage.fromEcrRepository(props.repository, imageTag),
			cpu: config.cpu,
			// A hard ceiling, plus a lower SOFT reservation that ECS places against
			// — which is what lets the outgoing and incoming tasks overlap briefly
			// on one instance during a deploy.
			memoryLimitMiB: config.memoryMiB,
			memoryReservationMiB: config.memoryReservationMiB,
			environment,
			secrets,
			logging: ecs.LogDrivers.awsLogs({
				streamPrefix: "app",
				logGroup: this.logGroup,
			}),
			// A wedged process that still holds the port would satisfy the ALB
			// forever; this replaces it.
			healthCheck: {
				command: [
					"CMD-SHELL",
					`node -e "fetch('http://127.0.0.1:${config.containerPort}/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`,
				],
				interval: Duration.seconds(30),
				timeout: Duration.seconds(5),
				retries: 3,
				startPeriod: Duration.seconds(60),
			},
			// ⚠ Long enough for `after()` work (the cache counters) to finish
			// after the response — see AGENTS.md on next/server `after`.
			stopTimeout: Duration.seconds(config.stopTimeoutSeconds),
		});
		container.addPortMappings({
			containerPort: config.containerPort,
			protocol: ecs.Protocol.TCP,
		});

		// ── The migration task ──────────────────────────────────────────────────
		// Migrations must land BEFORE the new code serves traffic (ADR-0024
		// migrate-before-serve). CI may run them directly; this task definition
		// exists so they can also run inside the VPC, with the same secret.
		// ⚠ It needs an image that carries dev dependencies (tsx + drizzle-kit);
		// the app runtime image does not.
		this.migrationTaskDefinition = new ecs.Ec2TaskDefinition(
			this,
			"MigrationTask",
			{
				// D: a FIXED family, so deploy-aws.yml can `run-task` it by name and
				// the GitHub role's RunTask grant can be scoped to exactly this.
				family: `zugzwang-${config.name}-migrate`,
				networkMode: ecs.NetworkMode.AWS_VPC,
				executionRole: props.executionRole,
				taskRole: props.taskRole,
			},
		);
		this.migrationTaskDefinition.addContainer("migrate", {
			// D: a STABLE tag the workflow re-points at each build's migrate image
			// before running this task — migrations run BEFORE the compute stack
			// is deployed (migrate-before-serve), so the task cannot wait for this
			// stack to learn the new image tag. The per-build `<tag>-migrate` is
			// still pushed alongside it for provenance.
			image: ecs.ContainerImage.fromEcrRepository(
				props.repository,
				`${config.name}-migrate`,
			),
			cpu: 512,
			memoryLimitMiB: 1024,
			memoryReservationMiB: 512,
			command: [...config.migrationCommand],
			environment: {
				ZUGZWANG_ENV: config.zugzwangEnv,
				DB_POOLER_MODE: "session",
			},
			// ONLY the suffix-separated keys the migration scripts read
			// (`DATABASE_URL_<ENV>` + the ref fragment — measured: `migrate-*.ts`
			// and `apply-migrations-per-tx.ts` read nothing else). Production-
			// readiness review (security M1): the GitHub deploy role may `RunTask`
			// this family, and a RunTask can override the command, so every secret
			// injected here is one command-override away from exfiltration. The
			// app's 32 runtime keys stay on the app container only.
			// ⚠ This also retires the migrate task as a vehicle for ad-hoc engine
			// runs that need app credentials (the 06 §10.6 fixture void used it).
			secrets: {
				...Object.fromEntries(
					config.migrationSecretKeys.map((key) => [
						key,
						ecs.Secret.fromSecretsManager(props.appSecret, key),
					]),
				),
			},
			logging: ecs.LogDrivers.awsLogs({
				streamPrefix: "migrate",
				logGroup: this.logGroup,
			}),
		});

		// ── Load balancer ───────────────────────────────────────────────────────
		this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "Alb", {
			vpc: props.vpc,
			internetFacing: true,
			securityGroup: props.albSecurityGroup,
			idleTimeout: Duration.seconds(60),
			http2Enabled: true,
			// ⛔ ADR-0061 A2/F3 — the client-IP derivation (src/server/middleware/
			// client-ip.ts) reads the LAST X-Forwarded-For entry as the ALB's own
			// statement of who connected. That holds only in APPEND mode, so it is
			// pinned rather than inherited: `preserve` hands that slot to the
			// client, `remove` makes every peer null. Dropping invalid header
			// fields keeps malformed header names from reaching the app at all —
			// ⚠ which includes any header NAME containing `_` (none in use today;
			// cron sends `Authorization`, every app header is hyphenated).
			xffHeaderProcessingMode: elbv2.XffHeaderProcessingMode.APPEND,
			dropInvalidHeaderFields: true,
		});

		this.targetGroup = new elbv2.ApplicationTargetGroup(this, "AppTargets", {
			vpc: props.vpc,
			port: config.containerPort,
			protocol: elbv2.ApplicationProtocol.HTTP,
			targetType: elbv2.TargetType.IP,
			// 30 s matches the container stop timeout: in-flight requests and the
			// deferred `after()` work both get to finish before the task goes.
			deregistrationDelay: Duration.seconds(30),
			healthCheck: {
				// `/api/ready` (AWS-MIGRATION-3): a task joins the target group only
				// after it has rendered the home page and every Open market once.
				// The CONTAINER health check above stays on `/api/health` — that one
				// decides whether the process is alive, this one whether it is warm.
				path: config.readinessPath,
				healthyHttpCodes: "200",
				interval: Duration.seconds(15),
				timeout: Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
		});

		// ⚠ ONE port-80 listener construct in BOTH cases, and that is a CloudFormation
		// constraint rather than a style choice. Modelled as two constructs (an HTTP
		// listener without a certificate, a redirect listener with one), the first
		// deploy that adds a certificate asks CloudFormation to CREATE the redirect
		// on :80 before it DELETES the old listener on :80 — and the ALB refuses:
		// "A listener already exists on this port" (measured at AWS-MIGRATION-2;
		// the update rolled back cleanly). Keeping the logical id stable and
		// varying only the default action makes it an in-place UPDATE.
		const certificate = config.certificateArn
			? acm.Certificate.fromCertificateArn(
					this,
					"Certificate",
					config.certificateArn,
				)
			: undefined;
		this.loadBalancer.addListener("Http", {
			port: 80,
			protocol: elbv2.ApplicationProtocol.HTTP,
			defaultAction: certificate
				? elbv2.ListenerAction.redirect({
						protocol: "HTTPS",
						port: "443",
						permanent: true,
					})
				: elbv2.ListenerAction.forward([this.targetGroup]),
		});
		if (certificate) {
			this.loadBalancer.addListener("Https", {
				port: 443,
				protocol: elbv2.ApplicationProtocol.HTTPS,
				certificates: [certificate],
				sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
				defaultTargetGroups: [this.targetGroup],
			});
		}
		// Without a certificate the :80 listener forwards, so the stack still
		// synthesizes and can be deployed before DNS/ACM exist. Never leave an
		// environment in that state once it serves real traffic.

		// ── Service ─────────────────────────────────────────────────────────────
		this.service = new ecs.Ec2Service(this, "Service", {
			cluster,
			taskDefinition,
			desiredCount: config.desiredCount,
			securityGroups: [props.serviceSecurityGroup],
			vpcSubnets: props.serviceSubnets,
			// ⚠ No assignPublicIp here, unlike Fargate: the INSTANCE carries the
			// public IP (or sits behind NAT) and the task inherits its route to the
			// internet from the host. Reachability is now a property of the subnet
			// the ASG launches into.
			capacityProviderStrategies: [
				{ capacityProvider: capacityProvider.capacityProviderName, weight: 1 },
			],
			// A deployment that fails its health checks rolls back on its own
			// rather than waiting for a human to notice.
			circuitBreaker: { enable: true, rollback: true },
			// 100/200 with managed scaling: the new task starts before the old one
			// stops, and ECS asks the ASG for an instance if there is no room.
			minHealthyPercent: 100,
			maxHealthyPercent: 200,
			// Long enough for the /api/ready warm-up (bounded at 90 s) plus boot.
			healthCheckGracePeriod: Duration.seconds(
				config.healthCheckGracePeriodSeconds,
			),
			enableExecuteCommand: config.enableExecuteCommand,
		});
		this.service.attachToApplicationTargetGroup(this.targetGroup);

		/**
		 * ⚠ Scaling out is a CORRECTNESS decision here, not a capacity one.
		 * `cacheComponents` keeps Next's cache per process and `revalidateTag`
		 * reaches only the task that handled the request, so a second task can
		 * keep serving a moderated-away comment for the cache window. Config pins
		 * `maxCapacity: 1` until a shared cache handler exists.
		 */
		if (config.maxCapacity > config.desiredCount) {
			const scaling = this.service.autoScaleTaskCount({
				minCapacity: config.desiredCount,
				maxCapacity: config.maxCapacity,
			});
			scaling.scaleOnCpuUtilization("CpuScaling", {
				targetUtilizationPercent: 60,
				scaleInCooldown: Duration.minutes(5),
				scaleOutCooldown: Duration.minutes(1),
			});
		}

		// ── Optional edge ───────────────────────────────────────────────────────
		if (config.wafEnabled) {
			const webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
				scope: "REGIONAL",
				defaultAction: { allow: {} },
				visibilityConfig: {
					cloudWatchMetricsEnabled: true,
					metricName: `zugzwang-${config.name}-waf`,
					sampledRequestsEnabled: true,
				},
				rules: [
					{
						name: "AWSManagedRulesCommonRuleSet",
						priority: 1,
						// I — `count` records matches without blocking; see
						// EnvironmentConfig.wafMode.
						overrideAction:
							config.wafMode === "block" ? { none: {} } : { count: {} },
						statement: {
							managedRuleGroupStatement: {
								vendorName: "AWS",
								name: "AWSManagedRulesCommonRuleSet",
							},
						},
						visibilityConfig: {
							cloudWatchMetricsEnabled: true,
							metricName: "common-rule-set",
							sampledRequestsEnabled: true,
						},
					},
				],
			});
			new wafv2.CfnWebACLAssociation(this, "WebAclAssociation", {
				resourceArn: this.loadBalancer.loadBalancerArn,
				webAclArn: webAcl.attrArn,
			});
		}

		if (config.cloudFrontEnabled) {
			// Off by default: Cloudflare already fronts this domain, and two CDNs
			// in series is one too many. Turned on, it caches the immutable
			// `/_next/static/*` assets and passes everything else through.
			const origin = new origins.LoadBalancerV2Origin(this.loadBalancer, {
				protocolPolicy: config.certificateArn
					? cloudfront.OriginProtocolPolicy.HTTPS_ONLY
					: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
			});
			new cloudfront.Distribution(this, "Cdn", {
				defaultBehavior: {
					origin,
					viewerProtocolPolicy:
						cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
					// Dynamic HTML: never cached at the edge, and cookies and
					// headers must reach the origin or auth breaks.
					cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
					originRequestPolicy:
						cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
				},
				additionalBehaviors: {
					"/_next/static/*": {
						origin,
						viewerProtocolPolicy:
							cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
						cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
					},
				},
				comment: `Zugzwang ${config.name}`,
			});
		}

		if (config.hostedZone) {
			const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
				hostedZoneId: config.hostedZone.hostedZoneId,
				zoneName: config.hostedZone.zoneName,
			});
			new route53.ARecord(this, "AliasRecord", {
				zone,
				recordName: config.hostedZone.recordName,
				target: route53.RecordTarget.fromAlias(
					new targets.LoadBalancerTarget(this.loadBalancer),
				),
			});
		}

		new CfnOutput(this, "LoadBalancerDns", {
			value: this.loadBalancer.loadBalancerDnsName,
			description: "Point DNS at this, then verify /api/health",
		});
		new CfnOutput(this, "ServiceName", { value: this.service.serviceName });
		new CfnOutput(this, "ClusterName", { value: cluster.clusterName });
		// D — what deploy-aws.yml needs to start the migration task in the VPC.
		new CfnOutput(this, "MigrationTaskFamily", {
			value: this.migrationTaskDefinition.family,
		});
		new CfnOutput(this, "MigrationSubnetIds", {
			value: props.vpc.selectSubnets(props.serviceSubnets).subnetIds.join(","),
		});
		new CfnOutput(this, "MigrationSecurityGroupId", {
			value: props.serviceSecurityGroup.securityGroupId,
		});
		new CfnOutput(this, "CapacityProviderName", {
			value: capacityProvider.capacityProviderName,
		});
		new CfnOutput(this, "EcrRepositoryUri", {
			value: props.repository.repositoryUri,
		});
		new CfnOutput(this, "DeployedImageTag", { value: imageTag });
	}
}
