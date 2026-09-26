import {
	CfnOutput,
	Duration,
	RemovalPolicy,
	Stack,
	type StackProps,
} from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import type * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../config/types";

export interface DatabaseStackProps extends StackProps {
	readonly config: EnvironmentConfig;
	readonly vpc: ec2.IVpc;
	readonly databaseSecurityGroup: ec2.ISecurityGroup;
	readonly databaseSubnets: ec2.SubnetSelection;
}

/**
 * The database name, which is ALSO the value of `cron.database_name` below.
 * They are one constant because pg_cron runs its scheduler in exactly one
 * database per cluster, and a job registered anywhere else never fires — with
 * no error, anywhere. Migrations 0007, 0011 and 0027 register jobs in whatever
 * database `DATABASE_URL` names, so the two MUST agree.
 */
const DATABASE_NAME = "zugzwang";

/**
 * RDS for PostgreSQL 17 (AWS-MIGRATION-1 / ADR-0059).
 *
 * ⚠ THE APPLICATION DOES NOT REFERENCE THIS STACK. The tasks read `DATABASE_URL`
 * from the app secret (`zugzwang/<env>`), which the operator composes from the
 * outputs below at cutover. That is deliberate rather than lazy: it keeps the
 * compute stack free of a dependency on the database stack, so a database
 * replacement (restore from snapshot, resize) is never a compute redeploy, and
 * the cutover itself stays what the runbook says it is — one value changed in
 * the vault.
 *
 * ⚠ `pg_cron` IS A PARAMETER-GROUP CONCERN, NOT A MIGRATION CONCERN. The
 * migrations run `CREATE EXTENSION pg_cron` and `cron.schedule(...)`, but on RDS
 * the extension cannot load unless `shared_preload_libraries` names it BEFORE
 * the instance boots. A default parameter group therefore fails migration 0007
 * with "pg_cron must be loaded via shared_preload_libraries" — which is a loud
 * failure and the good kind. The quiet kind is `cron.database_name` pointing at
 * the wrong database: jobs register, nothing fires, markets never close.
 */
export class DatabaseStack extends Stack {
	public readonly instance: rds.DatabaseInstance;

	constructor(scope: Construct, id: string, props: DatabaseStackProps) {
		super(scope, id, props);
		const { config } = props;
		const db = config.database;

		const engine = rds.DatabaseInstanceEngine.postgres({
			version: rds.PostgresEngineVersion.VER_17_6,
		});

		const parameterGroup = new rds.ParameterGroup(this, "Parameters", {
			engine,
			// ASCII only: RDS rejects any non-ASCII byte in a parameter group description
			// as a "non-printable control character" (measured on the first staging deploy).
			description: `Zugzwang ${config.name} - PostgreSQL 17 with pg_cron`,
			parameters: {
				// `pg_stat_statements` is RDS's own default entry; dropping it by
				// overwriting the list would silently remove query statistics.
				shared_preload_libraries: "pg_stat_statements,pg_cron",
				"cron.database_name": DATABASE_NAME,
			},
		});

		this.instance = new rds.DatabaseInstance(this, "Postgres", {
			engine,
			// CDK prepends `db.` itself.
			instanceType: new ec2.InstanceType(db.instanceType),
			vpc: props.vpc,
			vpcSubnets: props.databaseSubnets,
			securityGroups: [props.databaseSecurityGroup],
			databaseName: DATABASE_NAME,
			// ⛔ GENERATED, NEVER CONFIGURED. RDS mints the password into a Secrets
			// Manager secret of its own; no synth artifact, config file or commit
			// ever carries it. The operator reads it once, to compose DATABASE_URL.
			credentials: rds.Credentials.fromGeneratedSecret(db.masterUsername, {
				secretName: `zugzwang/${config.name}/database`,
			}),
			parameterGroup,
			multiAz: db.multiAz,
			allocatedStorage: db.allocatedStorageGb,
			maxAllocatedStorage: db.maxAllocatedStorageGb,
			storageType: rds.StorageType.GP3,
			storageEncrypted: true,
			backupRetention: Duration.days(db.backupRetentionDays),
			// Automated backups outlive the instance. A deleted database whose
			// backups vanished with it is the one outcome nothing can repair.
			deleteAutomatedBackups: false,
			copyTagsToSnapshot: true,
			deletionProtection: db.deletionProtection,
			// `cdk destroy` leaves a final snapshot rather than nothing.
			removalPolicy: RemovalPolicy.SNAPSHOT,
			publiclyAccessible: false,
			autoMinorVersionUpgrade: true,
			// Low-traffic hours in IST (UTC+5:30): backups ~03:30 IST, maintenance
			// early Monday. The migration plan's own window sits in the same hours.
			preferredBackupWindow: "22:00-23:00",
			preferredMaintenanceWindow: "sun:23:00-mon:00:00",
			cloudwatchLogsExports: ["postgresql"],
			cloudwatchLogsRetention: config.logRetentionDays as logs.RetentionDays,
			// ⚠ Deliberately OFF. Performance Insights is not supported on the
			// t4g.micro / t4g.small classes; leaving it on fails the deploy.
			enablePerformanceInsights: false,
		});

		new CfnOutput(this, "Endpoint", {
			value: this.instance.dbInstanceEndpointAddress,
			description: "Host part of DATABASE_URL",
		});
		new CfnOutput(this, "Port", {
			value: this.instance.dbInstanceEndpointPort,
		});
		new CfnOutput(this, "DatabaseName", { value: DATABASE_NAME });
		new CfnOutput(this, "CredentialsSecretArn", {
			value: this.instance.secret?.secretArn ?? "(none)",
			description:
				"Secrets Manager secret holding username/password — compose DATABASE_URL from it, then set the *_PROJECT_REF_FRAGMENT guard to this host",
		});
	}
}
