import { Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../config/types";

export interface NetworkStackProps extends StackProps {
	readonly config: EnvironmentConfig;
}

/**
 * VPC and the two security groups.
 *
 * The application is stateless and every dependency it has — Supabase, Upstash,
 * R2, OpenAI, Resend, Sentry, PostHog — is an outbound HTTPS call. So the only
 * network decisions that matter are: what can reach the tasks (the ALB, and
 * nothing else), and how the tasks reach the internet (NAT, or a public subnet
 * with no inbound rules).
 */
export class NetworkStack extends Stack {
	public readonly vpc: ec2.Vpc;
	public readonly albSecurityGroup: ec2.SecurityGroup;
	public readonly serviceSecurityGroup: ec2.SecurityGroup;
	/** Where the Fargate tasks are placed — public without NAT, private with. */
	public readonly serviceSubnets: ec2.SubnetSelection;

	constructor(scope: Construct, id: string, props: NetworkStackProps) {
		super(scope, id, props);
		const { config } = props;

		const subnetConfiguration: ec2.SubnetConfiguration[] = [
			{ name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
		];
		if (config.natGateways > 0) {
			subnetConfiguration.push({
				name: "private",
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				cidrMask: 24,
			});
		}

		this.vpc = new ec2.Vpc(this, "Vpc", {
			ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
			maxAzs: 2,
			natGateways: config.natGateways,
			subnetConfiguration,
			// Two AZs so ECS can reschedule the task if one AZ fails.
		});

		this.albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
			vpc: this.vpc,
			description: "Public ingress for the Zugzwang ALB",
			allowAllOutbound: true,
		});
		this.albSecurityGroup.addIngressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(443),
			"HTTPS from the internet",
		);
		this.albSecurityGroup.addIngressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(80),
			"HTTP, redirected to HTTPS",
		);

		this.serviceSecurityGroup = new ec2.SecurityGroup(
			this,
			"ServiceSecurityGroup",
			{
				vpc: this.vpc,
				description: "Zugzwang Fargate tasks",
				// Outbound only: Supabase, Upstash, R2, OpenAI, Resend, Sentry,
				// PostHog are all reached over HTTPS from the task.
				allowAllOutbound: true,
			},
		);
		// ⛔ The ONLY ingress rule. No SSH, no bastion, no public port — a task is
		// reachable from the load balancer and from nothing else, whether it sits
		// in a public subnet or a private one.
		this.serviceSecurityGroup.addIngressRule(
			this.albSecurityGroup,
			ec2.Port.tcp(config.containerPort),
			"ALB to the app container",
		);

		this.serviceSubnets =
			config.natGateways > 0
				? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
				: { subnetType: ec2.SubnetType.PUBLIC };
	}
}
