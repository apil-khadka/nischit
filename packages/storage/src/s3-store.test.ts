import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3ObjectStore, evidenceKey } from "./s3-store.js";

const sha256 = (body: Uint8Array) => createHash("sha256").update(body).digest("hex");

describe("S3-compatible evidence store", () => {
  it("uses tenant-scoped evidence keys and verifies upload checksums", async () => {
    const send = vi.fn().mockResolvedValue({});
    const store = new S3ObjectStore({ send }, "evidence");
    const body = new TextEncoder().encode("coa evidence");
    const checksum = sha256(body);
    const result = await store.putEvidence({
      tenantId: "tenant-a",
      objectId: "object-1",
      contentType: "application/pdf",
      body,
      sha256: checksum,
    });
    expect(result).toEqual({ key: "tenants/tenant-a/evidence/object-1", sha256: checksum });
    expect(send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    expect((send.mock.calls[0]![0] as PutObjectCommand).input).toMatchObject({
      Bucket: "evidence",
      Key: "tenants/tenant-a/evidence/object-1",
      Metadata: { "tenant-id": "tenant-a", sha256: checksum },
    });
    await expect(store.putEvidence({
      tenantId: "tenant-a",
      objectId: "object-2",
      contentType: "text/plain",
      body,
      sha256: "wrong",
    })).rejects.toThrow("checksum");
  });

  it("rejects path traversal and verifies stored metadata on reads", async () => {
    expect(() => evidenceKey("tenant/a", "object-1")).toThrow();
    expect(() => evidenceKey("tenant-a", "../private")).toThrow();
    expect(() => evidenceKey("tenant-a", "".padStart(129, "x"))).toThrow();
    const body = new TextEncoder().encode("receipt");
    const send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => body },
      ContentType: "text/plain",
      Metadata: { "tenant-id": "tenant-a", sha256: sha256(body) },
    });
    const store = new S3ObjectStore({ send }, "evidence");
    const result = await store.getEvidence({ tenantId: "tenant-a", objectId: "object-1" });
    expect(result.sha256).toBe(sha256(body));
    expect(send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    await expect(store.presignEvidence({ tenantId: "tenant-a", objectId: "object-1", expiresInSeconds: 604_801 }))
      .rejects.toThrow("7 days");
  });
});
