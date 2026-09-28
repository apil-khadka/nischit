import type { ChainVerification, PublicAttestationRail } from "@nischit/domain";
import { createClient, createKeyPairSignerFromBytes } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { getAddMemoInstruction, SUPPORTED_MEMO_PROGRAM_ADDRESSES } from "@solana-program/memo";

export interface SolanaMemoRailConfig {
  rpcUrl: string;
  rpcSubscriptionsUrl?: string;
  signerSecretKey: Uint8Array;
  memoPrefix?: string;
  networkName?: string;
}

/** Publish a compact, non-sensitive verification commitment as a Solana memo. */
export class SolanaMemoAttestationRail implements PublicAttestationRail {
  private readonly config;

  constructor(config: SolanaMemoRailConfig) {
    this.config = config;
  }

  async publish(input: Parameters<PublicAttestationRail["publish"]>[0]) {
    const payer = await createKeyPairSignerFromBytes(this.config.signerSecretKey);
    const client = createClient()
      .use(signer(payer))
      .use(solanaRpc({ rpcUrl: this.config.rpcUrl, ...(this.config.rpcSubscriptionsUrl ? { rpcSubscriptionsUrl: this.config.rpcSubscriptionsUrl } : {}) }));
    const memo = [this.config.memoPrefix ?? "nischit:v1", input.purchaseOrderId, input.settlementReference, input.termsHash,
      input.conditionReportHash ?? "", input.qaDecisionHash ?? "", input.paymentReference ?? ""].join("|");
    if (Buffer.byteLength(memo, "utf8") > 566) throw new Error("Solana memo exceeds the conservative transaction budget");
    const instruction = getAddMemoInstruction({ memo });
    const result = await client.sendTransaction([instruction]);
    return { signature: String(result.context.signature) };
  }

  async verify(input: Parameters<PublicAttestationRail["verify"]>[0]): Promise<ChainVerification> {
    const signatureValue = input.signature;
    const base = { rail: "solana" as const, ...(signatureValue ? { reference: signatureValue } : {}), ...(this.config.networkName ? { network: this.config.networkName } : {}) };
    if (!signatureValue || !/^[1-9A-HJ-NP-Za-km-z]{32,90}$/.test(signatureValue)) {
      return { ...base, status: "unavailable", detail: "No valid Solana transaction signature is recorded." };
    }
    const expectedMemo = [this.config.memoPrefix ?? "nischit:v1", input.purchaseOrderId, input.settlementReference, input.termsHash,
      input.conditionReportHash ?? "", input.qaDecisionHash ?? "", input.paymentReference ?? ""].join("|");
    try {
      const [statusResponse, transactionResponse] = await Promise.all([
        this.rpc<SolanaRpcStatusResult>("getSignatureStatuses", [[signatureValue], { searchTransactionHistory: true }]),
        this.rpc<SolanaRpcTransactionResult>("getTransaction", [signatureValue, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]),
      ]);
      const status = statusResponse?.value?.[0];
      if (!status || !transactionResponse) return { ...base, status: "pending", detail: "Solana has not confirmed this transaction yet." };
      if (status.err || transactionResponse.meta?.err) return { ...base, status: "failed", slot: String(transactionResponse.slot), detail: "Solana transaction failed on chain." };
      const memoProgramIds = new Set<string>(SUPPORTED_MEMO_PROGRAM_ADDRESSES);
      const instructions = [
        ...(transactionResponse.transaction?.message?.instructions ?? []),
        ...(transactionResponse.meta?.innerInstructions ?? []).flatMap((item: { instructions?: unknown[] }) => item.instructions ?? []),
      ] as SolanaParsedInstruction[];
      const memos = instructions.filter((instruction) => instruction.programId && memoProgramIds.has(instruction.programId)).map((instruction) => {
        if (typeof instruction.parsed?.info?.memo === "string") return instruction.parsed.info.memo;
        return typeof instruction.data === "string" ? decodeBase58Utf8(instruction.data) : undefined;
      }).filter((memo): memo is string => memo !== undefined);
      if (!memos.includes(expectedMemo)) return { ...base, status: "mismatch", slot: String(transactionResponse.slot), detail: "Confirmed Solana transaction does not contain the expected Nischit verification memo." };
      const confirmationStatus = status.confirmationStatus as string | null;
      if (confirmationStatus !== "confirmed" && confirmationStatus !== "finalized") {
        return { ...base, status: "pending", slot: String(transactionResponse.slot), detail: "Solana transaction is processed but not yet confirmed." };
      }
      return { ...base, status: "verified", slot: String(transactionResponse.slot), detail: "Confirmed Solana memo matches the public verification commitment." };
    } catch (error) {
      return { ...base, status: "unverifiable", detail: error instanceof Error ? `Solana RPC verification failed: ${error.message}` : "Solana RPC verification failed." };
    }
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T | undefined> {
    const response = await fetch(this.config.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `nischit-${method}`, method, params }),
    });
    if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}`);
    const payload = await response.json() as { result?: T; error?: { message?: string } };
    if (payload.error) throw new Error(payload.error.message ?? "RPC returned an error");
    return payload.result;
  }
}

const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decodeBase58Utf8(value: string): string | undefined {
  try {
    let number = 0n;
    for (const character of value) {
      const digit = base58Alphabet.indexOf(character);
      if (digit < 0) return undefined;
      number = number * 58n + BigInt(digit);
    }
    const bytes: number[] = [];
    while (number > 0n) { bytes.unshift(Number(number & 255n)); number >>= 8n; }
    for (const character of value) { if (character !== "1") break; bytes.unshift(0); }
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return undefined;
  }
}

type SolanaRpcStatusResult = { value?: Array<{ confirmationStatus?: string | null; err?: unknown; slot: number | bigint } | null> };
type SolanaRpcTransactionResult = {
  slot: number | bigint;
  transaction?: { message?: { instructions?: unknown[] } };
  meta?: { err?: unknown; innerInstructions?: Array<{ instructions?: unknown[] }> };
};
type SolanaParsedInstruction = { programId?: string; parsed?: { info?: { memo?: unknown } }; data?: string };

export function parseSolanaSecretKey(encoded: string): Uint8Array {
  const value = encoded.trim();
  let bytes: Uint8Array;
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed) || parsed.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) throw new Error();
      bytes = Uint8Array.from(parsed);
    } catch {
      throw new Error("Invalid Solana JSON secret key");
    }
  } else {
    if (!value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) throw new Error("Invalid Solana base64 secret key");
    bytes = Uint8Array.from(Buffer.from(value, "base64"));
  }
  if (bytes.length !== 32 && bytes.length !== 64) throw new Error("Solana secret key must be 32 or 64 bytes");
  return bytes;
}
