import { Duration, SecretValue, Stack, type StackProps } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as eventTargets from "aws-cdk-lib/aws-events-targets";
import type { Construct } from "constructs";
import { CRON_JOBS, type EnvironmentConfig } from "../config/types";

export interface SchedulerStackProps extends StackProps {
	readonly config: EnvironmentConfig;
}

/**
 * The three scheduled jobs `vercel.json` runs today.
 *
 * ⛔ `close-due-markets` is the one that matters: nothing else moves a market
 * out of `Open` at its deadline, so a silent scheduler failure looks like a
 * product bug hours later. That is why every rule here is alarmed in the
 * monitoring stack on `FailedInvocations`.
 *
 * EventBridge RULES with an API destination are used rather than EventBridge
 * Scheduler, because the target is an HTTPS endpoint with an Authorization
 * header — which is exactly what a Connection + API destination provides, and
 * what Scheduler would need a Lambda shim to do.
 *
 * The routes already verify `Authorization: Bearer <CRON_SECRET>` with a
 * constant-time compare, so NO application change is needed. The header value
 * is read from the same Secrets Manager secret the app uses, under a key that
 * holds the complete header value (`Bearer …`).
 */
export class SchedulerStack extends Stack {
	public readonly ruleNames: string[] = [];

	constructor(scope: Construct, id: string, props: SchedulerStackProps) {
		super(scope, id, props);
		const { config } = props;

		const connection = new events.Connection(this, "CronConnection", {
			connectionName: `zugzwang-${config.name}-cron`,
			description: "Bearer token for the Zugzwang cron endpoints",
			authorization: events.Authorization.apiKey(
				"Authorization",
				SecretValue.secretsManager(config.secretName, {
					jsonField: config.cronAuthHeaderKey,
				}),
			),
		});

		for (const job of CRON_JOBS) {
			const destination = new events.ApiDestination(
				this,
				`${job.id}Destination`,
				{
					connection,
					endpoint: `${config.appBaseUrl}${job.path}`,
					httpMethod: events.HttpMethod.GET,
					// A retry storm must never become load on the bet path.
					rateLimitPerSecond: 1,
					description: job.description,
				},
			);

			const rule = new events.Rule(this, `${job.id}Rule`, {
				ruleName: `zugzwang-${config.name}-${job.id.toLowerCase()}`,
				description: job.description,
				schedule: events.Schedule.expression(job.schedule),
			});
			rule.addTarget(
				new eventTargets.ApiDestination(destination, {
					retryAttempts: 2,
					maxEventAge: Duration.minutes(2),
				}),
			);
			this.ruleNames.push(rule.ruleName);
		}
	}
}
