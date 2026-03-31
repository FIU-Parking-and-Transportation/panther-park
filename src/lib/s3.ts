import { S3Client } from "bun";

/**
 * Shared S3 client instance configured from environment variables.
 *
 * Required env vars:
 *   S3_ACCESS_KEY_ID      – AWS / S3-compatible access key ID
 *   S3_SECRET_ACCESS_KEY  – AWS / S3-compatible secret access key
 *   S3_BUCKET             – target bucket name
 *   S3_REGION             – AWS region (e.g. "us-east-1")
 *
 * Optional env vars:
 *   S3_ENDPOINT           – custom endpoint for S3-compatible services
 */
export const s3Client = new S3Client({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
});

/**
 * Build the public (non-signed) object URL for a given S3 key.
 *
 * Uses path-style when a custom endpoint is provided (e.g. MinIO), and
 * virtual-hosted-style for standard AWS S3.
 */
export function s3ObjectUrl(key: string): string {
  const bucket = process.env.S3_BUCKET ?? "";
  const region = process.env.S3_REGION ?? "us-east-1";
  const endpoint = process.env.S3_ENDPOINT;

  if (endpoint) {
    // Path-style: <endpoint>/<bucket>/<key>
    const base = endpoint.replace(/\/$/, "");
    return `${base}/${bucket}/${key}`;
  }

  // Virtual-hosted-style: https://<bucket>.s3.<region>.amazonaws.com/<key>
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Upload a base64-encoded image to S3 and return its public object URL.
 *
 * @param key        S3 object key (e.g. "lpr/<vehicleId>/context.jpg")
 * @param base64Data Raw base64 string (no data-URI prefix)
 * @param contentType MIME type (e.g. "image/jpeg")
 */
export async function uploadBase64Image(
  key: string,
  base64Data: string,
  contentType: string = "image/jpeg",
): Promise<string> {
  const bytes = Buffer.from(base64Data, "base64");
  const file = s3Client.file(key);
  await file.write(bytes, { type: contentType });
  return "s3://" + process.env.S3_BUCKET + "/" + key;
}
