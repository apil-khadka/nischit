import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface EvidenceObject {
  tenantId: string;
  objectId: string;
  contentType: string;
  body: Uint8Array;
  sha256: string;
}

export interface ObjectStore {
  putEvidence(input: EvidenceObject): Promise<{ key: string; sha256: string }>;
  getEvidence(input: { tenantId: string; objectId: string }): Promise<EvidenceObject>;
  presignEvidence(input: { tenantId: string; objectId: string; expiresInSeconds?: number }): Promise<string>;
}

export class EvidenceObjectAlreadyExistsError extends Error {
  constructor() {
    super("Evidence object identifiers are immutable and cannot be overwritten");
    this.name = "EvidenceObjectAlreadyExistsError";
  }
}

export const evidenceKey = (tenantId: string, objectId: string) => {
  const isSafeSegment = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
  if (!isSafeSegment(tenantId) || !isSafeSegment(objectId)) {
    throw new Error("Tenant and object identifiers must be non-empty opaque path segments");
  }
  return `tenants/${tenantId}/evidence/${objectId}`;
};

const digest = (body: Uint8Array) => createHash("sha256").update(body).digest("hex");

export class S3ObjectStore implements ObjectStore {
  constructor(
    private readonly client: Pick<S3Client, "send">,
    private readonly bucket: string,
    private readonly defaultExpirySeconds = 900,
  ) {
    if (!bucket) throw new Error("S3 bucket is required");
  }

  static fromConfig(config: S3ClientConfig & { bucket: string; defaultExpirySeconds?: number }) {
    const { bucket, defaultExpirySeconds, ...clientConfig } = config;
    return new S3ObjectStore(new S3Client(clientConfig), bucket, defaultExpirySeconds);
  }

  async putEvidence(input: EvidenceObject) {
    const key = evidenceKey(input.tenantId, input.objectId);
    const actualSha256 = digest(input.body);
    if (actualSha256 !== input.sha256) throw new Error("Evidence checksum does not match content");
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        IfNoneMatch: "*",
        Metadata: { "tenant-id": input.tenantId, sha256: actualSha256 },
      }));
    } catch (error) {
      const response = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (response.name === "PreconditionFailed" || response.name === "ConditionalRequestConflict" || response.$metadata?.httpStatusCode === 412) {
        throw new EvidenceObjectAlreadyExistsError();
      }
      throw error;
    }
    return { key, sha256: actualSha256 };
  }

  async getEvidence(input: { tenantId: string; objectId: string }) {
    const key = evidenceKey(input.tenantId, input.objectId);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error("Evidence object has no body");
    const body = await result.Body.transformToByteArray();
    const sha256 = digest(body);
    if (result.Metadata?.["tenant-id"] && result.Metadata["tenant-id"] !== input.tenantId) {
      throw new Error("Evidence tenant metadata does not match request");
    }
    if (result.Metadata?.sha256 && result.Metadata.sha256 !== sha256) {
      throw new Error("Evidence checksum does not match stored metadata");
    }
    return {
      tenantId: input.tenantId,
      objectId: input.objectId,
      contentType: result.ContentType ?? "application/octet-stream",
      body,
      sha256,
    } satisfies EvidenceObject;
  }

  async presignEvidence(input: { tenantId: string; objectId: string; expiresInSeconds?: number }) {
    const key = evidenceKey(input.tenantId, input.objectId);
    const expiresIn = input.expiresInSeconds ?? this.defaultExpirySeconds;
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 604_800) {
      throw new Error("Evidence presign expiry must be between 1 second and 7 days");
    }
    return getSignedUrl(this.client as S3Client, new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: "attachment",
    }), {
      expiresIn,
    });
  }
}
