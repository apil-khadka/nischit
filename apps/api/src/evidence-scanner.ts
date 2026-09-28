import { createConnection } from "node:net";

export type EvidenceContentType = "application/pdf" | "image/png" | "image/jpeg" | "text/plain";

export class EvidenceScanError extends Error {
  constructor(message: string, readonly kind: "infected" | "unavailable" | "unsupported") {
    super(message);
    this.name = "EvidenceScanError";
  }
}

export interface EvidenceScanner {
  scan(content: Uint8Array): Promise<void>;
}

/** Local/test adapter only. Production readiness requires ClamAV to be configured. */
export class DevelopmentEvidenceScanner implements EvidenceScanner {
  async scan(_content: Uint8Array): Promise<void> {}
}

export function validateEvidenceContent(content: Uint8Array, declaredType: string): EvidenceContentType {
  const declared = declaredType.split(";", 1)[0]?.trim().toLowerCase();
  const matches = (type: EvidenceContentType) => declared === type || declared === "application/octet-stream";
  const bytes = Buffer.from(content);

  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    if (matches("application/pdf")) return "application/pdf";
  } else if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (matches("image/png")) return "image/png";
  } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    if (matches("image/jpeg")) return "image/jpeg";
  } else if (matches("text/plain")) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (!text.includes("\u0000")) return "text/plain";
    } catch {
      // Invalid UTF-8 is not accepted as plain text.
    }
  }

  throw new EvidenceScanError("Evidence format is unsupported or does not match its content", "unsupported");
}

export class ClamAvEvidenceScanner implements EvidenceScanner {
  constructor(
    private readonly host: string,
    private readonly port = 3310,
    private readonly timeoutMs = 30_000,
  ) {
    if (!host.trim()) throw new Error("Evidence scanner host is required");
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("Evidence scanner port is invalid");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error("Evidence scanner timeout must be positive");
  }

  scan(content: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      let settled = false;
      let response = Buffer.alloc(0);
      const fail = (error: EvidenceScanError) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };

      socket.setTimeout(this.timeoutMs, () => fail(new EvidenceScanError("Evidence scanner timed out", "unavailable")));
      socket.once("error", () => fail(new EvidenceScanError("Evidence scanner is unavailable", "unavailable")));
      socket.once("close", () => {
        if (!settled) fail(new EvidenceScanError("Evidence scanner closed before responding", "unavailable"));
      });
      socket.on("data", (chunk: Buffer) => {
        response = Buffer.concat([response, chunk]);
        if (!response.includes(0) && !response.includes(10)) return;
        const result = response.toString("utf8").replace(/[\0\r\n]+$/, "");
        if (result.endsWith(": OK")) {
          settled = true;
          socket.end();
          resolve();
        } else if (result.includes(" FOUND")) {
          fail(new EvidenceScanError("Evidence file was identified as malicious", "infected"));
        } else {
          fail(new EvidenceScanError("Evidence scanner could not verify the file", "unavailable"));
        }
      });
      socket.once("connect", () => {
        const chunks: Buffer[] = [Buffer.from("zINSTREAM\0", "ascii")];
        const bytes = Buffer.from(content);
        const chunkSize = 64 * 1024;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
          const size = Buffer.allocUnsafe(4);
          size.writeUInt32BE(chunk.length, 0);
          chunks.push(size, chunk);
        }
        chunks.push(Buffer.alloc(4));
        socket.end(Buffer.concat(chunks));
      });
    });
  }
}
