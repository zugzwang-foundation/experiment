import {
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";

// SCAFFOLD.15 type-contract probe per plan §11 carry-forward note 2 +
// kickoff "Verify @aws-sdk/s3-request-presigner getSignedUrl call shape".
// Pinned to @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner @ 3.1045.0
// per Q1 ratification; this probe surfaces any breaking API change at
// `pnpm vitest run` time rather than at deployment time.
//
// Probe is shape-only — no network calls. Constructs the client + commands
// + invokes getSignedUrl against a stub endpoint; the contract being
// verified is `getSignedUrl(client, command, { expiresIn }) → Promise<string>`.

describe("@aws-sdk/s3-request-presigner type-contract probe (SCAFFOLD.15)", () => {
	it("aws-sdk-presigned-put::getSignedUrl-returns-string-promise", async () => {
		// Construct against a stub endpoint with fake credentials; signing
		// requires no network. The returned URL is a fully-qualified string
		// embedding the X-Amz-Signature query parameter.
		const client = new S3Client({
			region: "auto",
			endpoint: "https://example.r2.cloudflarestorage.com",
			credentials: {
				accessKeyId: "AKIAEXAMPLE",
				secretAccessKey:
					"0000000000000000000000000000000000000000000000000000000000000000",
			},
			forcePathStyle: false,
		});

		const command = new PutObjectCommand({
			Bucket: "zugzwang-uploads",
			Key: "u/test-user/test-upload.jpg",
			ContentType: "image/jpeg",
		});

		const url = await getSignedUrl(client, command, { expiresIn: 60 });

		expect(typeof url).toBe("string");
		expect(url).toMatch(/^https:\/\//);
		expect(url).toContain("X-Amz-Signature=");
		expect(url).toContain("X-Amz-Expires=60");
	});

	it("aws-sdk-presigned-put::getSignedUrl-accepts-get-object-command", async () => {
		// Symmetric for GetObjectCommand — same getSignedUrl seam consumed by
		// `mintReadUrl` in r2.ts. Asserts the polymorphic getSignedUrl<Input,
		// Output> works for the GET path too.
		const client = new S3Client({
			region: "auto",
			endpoint: "https://example.r2.cloudflarestorage.com",
			credentials: {
				accessKeyId: "AKIAEXAMPLE",
				secretAccessKey:
					"0000000000000000000000000000000000000000000000000000000000000000",
			},
			forcePathStyle: false,
		});

		const command = new GetObjectCommand({
			Bucket: "zugzwang-uploads",
			Key: "u/test-user/test-upload.jpg",
		});

		const url = await getSignedUrl(client, command, { expiresIn: 3600 });

		expect(typeof url).toBe("string");
		expect(url).toContain("X-Amz-Expires=3600");
	});

	it("aws-sdk-presigned-put::HeadObjectCommand-input-shape", async () => {
		// HeadObjectCommand is the post-PUT verification primitive shipped
		// for future consumers (DEBATE.2 + admin moderation). Confirms the
		// command constructor accepts the canonical {Bucket, Key} shape
		// without an unexpected required field.
		const command = new HeadObjectCommand({
			Bucket: "zugzwang-uploads",
			Key: "u/test-user/test-upload.jpg",
		});
		expect(command.input.Bucket).toBe("zugzwang-uploads");
		expect(command.input.Key).toBe("u/test-user/test-upload.jpg");
	});
});
