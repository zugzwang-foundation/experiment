import { execSync } from "node:child_process";
import type { NextConfig } from "next";

const buildTimestamp = new Date().toISOString();
const buildGitSha = (() => {
	try {
		return execSync("git rev-parse --short HEAD").toString().trim();
	} catch {
		return "unknown";
	}
})();

const nextConfig: NextConfig = {
	env: {
		BUILD_TIMESTAMP: buildTimestamp,
		BUILD_GIT_SHA: buildGitSha,
	},
};

export default nextConfig;
