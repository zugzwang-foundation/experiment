import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import type * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../config/types";

export interface MonitoringStackProps extends StackProps {
	readonly config: EnvironmentConfig;
	/** Either launch type — the alarms below read metrics from the BASE service,
	 * so switching between Fargate and EC2 never touches this stack. */
	readonly service: ecs.BaseService;
	readonly loadBalancer: elbv2.ApplicationLoadBalancer;
	readonly targetGroup: elbv2.ApplicationTargetGroup;
	readonly cronRuleNames: readonly string[];
}

/**
 * Alarms and one dashboard.
 *
 * The alarm set is chosen from how this system actually fails: the bet path
 * erroring (5xx), the page getting slow (p95), the task dying (unhealthy
 * hosts), the box filling up (CPU/memory), and — the quiet one — a cron that
 * stops firing, which no user ever reports because nothing appears broken.
 */
export class MonitoringStack extends Stack {
	public readonly topic: sns.Topic;

	constructor(scope: Construct, id: string, props: MonitoringStackProps) {
		super(scope, id, props);
		const { config } = props;

		this.topic = new sns.Topic(this, "Alarms", {
			topicName: `zugzwang-${config.name}-alarms`,
			displayName: `Zugzwang ${config.name} alarms`,
		});
		if (config.alertEmail) {
			this.topic.addSubscription(
				new subscriptions.EmailSubscription(config.alertEmail),
			);
		}
		const action = new actions.SnsAction(this.topic);

		const alarm = (
			id: string,
			metric: cloudwatch.IMetric,
			threshold: number,
			description: string,
			evaluationPeriods = 2,
		): cloudwatch.Alarm => {
			const a = new cloudwatch.Alarm(this, id, {
				metric,
				threshold,
				evaluationPeriods,
				alarmDescription: description,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			});
			a.addAlarmAction(action);
			a.addOkAction(action);
			return a;
		};

		const target5xx = props.targetGroup.metrics.httpCodeTarget(
			elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
			{ period: Duration.minutes(5), statistic: "Sum" },
		);
		alarm(
			"Target5xxAlarm",
			target5xx,
			config.alarmThresholds.target5xxPerFiveMinutes,
			"The application is returning server errors",
			1,
		);

		alarm(
			"LatencyAlarm",
			props.targetGroup.metrics.targetResponseTime({
				period: Duration.minutes(5),
				statistic: "p95",
			}),
			config.alarmThresholds.p95LatencySeconds,
			"p95 response time is above the agreed bar",
		);

		alarm(
			"UnhealthyHostsAlarm",
			props.targetGroup.metrics.unhealthyHostCount({
				period: Duration.minutes(1),
				statistic: "Maximum",
			}),
			1,
			"A task is failing its health check",
		);

		alarm(
			"CpuAlarm",
			props.service.metricCpuUtilization({ period: Duration.minutes(5) }),
			config.alarmThresholds.cpuPercent,
			"Sustained high CPU on the task",
		);

		alarm(
			"MemoryAlarm",
			props.service.metricMemoryUtilization({ period: Duration.minutes(5) }),
			config.alarmThresholds.memoryPercent,
			"Sustained high memory on the task",
		);

		// ⛔ The quiet failure. A cron that stops firing produces no error page
		// and no user report — markets simply never close.
		const cronFailureMetrics = props.cronRuleNames.map(
			(ruleName) =>
				new cloudwatch.Metric({
					namespace: "AWS/Events",
					metricName: "FailedInvocations",
					dimensionsMap: { RuleName: ruleName },
					period: Duration.minutes(5),
					statistic: "Sum",
				}),
		);
		cronFailureMetrics.forEach((metric, index) => {
			alarm(
				`CronFailedInvocations${index}`,
				metric,
				1,
				`Scheduled job ${props.cronRuleNames[index]} failed to invoke`,
				1,
			);
		});

		// `close-due-markets` runs every minute, so an hour with no invocation at
		// all is unambiguous — the scheduler itself has stopped.
		const closeDueRule = props.cronRuleNames[0];
		if (closeDueRule) {
			const invocations = new cloudwatch.Metric({
				namespace: "AWS/Events",
				metricName: "Invocations",
				dimensionsMap: { RuleName: closeDueRule },
				period: Duration.minutes(15),
				statistic: "Sum",
			});
			const silent = new cloudwatch.Alarm(this, "CloseDueMarketsSilent", {
				metric: invocations,
				threshold: 1,
				evaluationPeriods: 1,
				comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
				alarmDescription:
					"close-due-markets has not fired for 15 minutes — markets will not close",
				treatMissingData: cloudwatch.TreatMissingData.BREACHING,
			});
			silent.addAlarmAction(action);
			silent.addOkAction(action);
		}

		new cloudwatch.Dashboard(this, "Dashboard", {
			dashboardName: `zugzwang-${config.name}`,
			widgets: [
				[
					new cloudwatch.GraphWidget({
						title: "Requests and errors",
						left: [
							props.loadBalancer.metrics.requestCount({
								period: Duration.minutes(5),
							}),
						],
						right: [target5xx],
						width: 12,
					}),
					new cloudwatch.GraphWidget({
						title: "Latency (p50 / p95)",
						left: [
							props.targetGroup.metrics.targetResponseTime({
								period: Duration.minutes(5),
								statistic: "p50",
							}),
							props.targetGroup.metrics.targetResponseTime({
								period: Duration.minutes(5),
								statistic: "p95",
							}),
						],
						width: 12,
					}),
				],
				[
					new cloudwatch.GraphWidget({
						title: "Task CPU / memory",
						left: [
							props.service.metricCpuUtilization({
								period: Duration.minutes(5),
							}),
							props.service.metricMemoryUtilization({
								period: Duration.minutes(5),
							}),
						],
						width: 12,
					}),
					new cloudwatch.GraphWidget({
						title: "Scheduled jobs",
						left: cronFailureMetrics,
						width: 12,
					}),
				],
			],
		});
	}
}
