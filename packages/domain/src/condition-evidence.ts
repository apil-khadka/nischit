import { createHash } from "node:crypto";
import { conflict } from "./errors.js";
import type {
  AcceptancePolicy,
  ConditionReading,
  ConditionReport,
  EvidenceDocument,
  Shipment,
} from "./types.js";

export interface ConditionEvidenceInput {
  id: string;
  shipmentId: string;
  readings: ConditionReading[];
  documents: EvidenceDocument[];
  policy: AcceptancePolicy;
  createdAt: string;
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
};

const hash = (value: unknown) => createHash("sha256").update(stableStringify(value)).digest("hex");

const merkleRoot = (leaves: string[]) => {
  if (leaves.length === 0) return hash([]);
  let level = [...leaves];
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index]!;
      const right = level[index + 1] ?? left;
      next.push(hash(`${left}:${right}`));
    }
    level = next;
  }
  return level[0]!;
};

const readingPayload = (reading: ConditionReading) => ({
  sequence: reading.sequence,
  timestamp: reading.timestamp,
  temperatureCelsius: reading.temperatureCelsius,
  ...(reading.deviceId ? { deviceId: reading.deviceId } : {}),
  ...(reading.humidityPercent !== undefined ? { humidityPercent: reading.humidityPercent } : {}),
  ...(reading.batteryPercent !== undefined ? { batteryPercent: reading.batteryPercent } : {}),
  ...(reading.previousHash ? { previousHash: reading.previousHash } : {}),
});

const readingCommitment = (reading: ConditionReading) => hash(readingPayload(reading));
const isSha256 = (value: string) => /^[a-f0-9]{64}$/i.test(value);

const validateEvidenceDocuments = (documents: EvidenceDocument[]) => {
  for (const document of documents) {
    if (!document.name.trim() || !document.sha256.trim()) throw conflict("Evidence documents need a name and reference");
    const uploaded = document.source === "upload" || document.source === "device" || document.objectId !== undefined;
    if (document.source === "manual" && document.objectId !== undefined) {
      throw conflict("Manual evidence cannot reference a private object");
    }
    if (uploaded && (!isSha256(document.sha256) || !document.objectId || !document.contentType?.trim())) {
      throw conflict("Uploaded evidence requires a SHA-256 hash, object reference, and content type");
    }
  }
};

/** Builds immutable evidence metrics from submitted readings and document references. */
export function createConditionReport(input: ConditionEvidenceInput): ConditionReport {
  validateEvidenceDocuments(input.documents);
  const sequences = [...input.readings].sort((a, b) => a.sequence - b.sequence);
  const invalidSequence = sequences.some((reading, index) =>
    !Number.isInteger(reading.sequence) || reading.sequence < 1 ||
    (index > 0 && reading.sequence <= sequences[index - 1]!.sequence),
  );
  const missingSequenceCount = sequences.reduce(
    (count, reading, index) => count + (index > 0 && reading.sequence !== sequences[index - 1]!.sequence + 1 ? 1 : 0),
    0,
  );
  const timestampValues = sequences.map((reading) => new Date(reading.timestamp).valueOf());
  const timestampsValid = timestampValues.every((timestamp, index) =>
    Number.isFinite(timestamp) && (index === 0 || timestamp >= timestampValues[index - 1]!),
  );
  const invalidMeasurement = sequences.some((reading) =>
    !Number.isFinite(reading.temperatureCelsius) ||
    (reading.humidityPercent !== undefined && (!Number.isFinite(reading.humidityPercent) || reading.humidityPercent < 0 || reading.humidityPercent > 100)) ||
    (reading.batteryPercent !== undefined && (!Number.isFinite(reading.batteryPercent) || reading.batteryPercent < 0 || reading.batteryPercent > 100)),
  );
  const chainClaimed = sequences.some((reading) => reading.deviceId !== undefined || reading.previousHash !== undefined);
  const signatureClaimed = chainClaimed || sequences.some((reading) => reading.signature !== undefined);
  // Device public-key verification is not configured, so claims cannot count as verified.
  const signatureCoverage = 0;
  const deviceIds = new Set(sequences.map((reading) => reading.deviceId).filter((deviceId): deviceId is string => Boolean(deviceId)));
  const hashChainValid = !chainClaimed || (
    deviceIds.size === 1 &&
    sequences.every((reading, index) => index === 0
      ? reading.previousHash === undefined || reading.previousHash === "GENESIS"
      : reading.previousHash === readingCommitment(sequences[index - 1]!))
  );
  const temperatures = sequences.map((reading) => reading.temperatureCelsius);
  const requiredDocumentsPresent = input.policy.requiredDocuments.every((name) =>
    input.documents.some((document) => document.name === name && document.sha256.length > 0),
  );
  const evidenceIntegrityValid = sequences.length > 0 && !invalidSequence && timestampsValid &&
    !invalidMeasurement && missingSequenceCount === 0 && requiredDocumentsPresent &&
    hashChainValid && !signatureClaimed && Number.isInteger(input.policy.maxTelemetryGapSeconds) &&
    input.policy.maxTelemetryGapSeconds > 0;
  const excursionReadings = sequences.map((reading) =>
    reading.temperatureCelsius < input.policy.minTemperatureCelsius || reading.temperatureCelsius > input.policy.maxTemperatureCelsius,
  );
  let excursionCount = 0;
  let longestExcursionSeconds = 0;
  let excursionStart: number | undefined;
  let excursionEnd: number | undefined;
  excursionReadings.forEach((isExcursion, index) => {
    if (isExcursion && !excursionReadings[index - 1]) {
      excursionCount += 1;
      if (timestampsValid) excursionStart = timestampValues[index]!;
    }
    if (isExcursion && timestampsValid) excursionEnd = timestampValues[index]!;
    if (!isExcursion && excursionReadings[index - 1] && excursionStart !== undefined && excursionEnd !== undefined) {
      longestExcursionSeconds = Math.max(longestExcursionSeconds, (excursionEnd - excursionStart) / 1000);
      excursionStart = undefined;
      excursionEnd = undefined;
    }
  });
  if (excursionStart !== undefined && excursionEnd !== undefined) {
    longestExcursionSeconds = Math.max(longestExcursionSeconds, (excursionEnd - excursionStart) / 1000);
  }
  const maximumObservedGapSeconds = timestampsValid && sequences.length > 1
    ? Math.max(...timestampValues.slice(1).map((timestamp, index) =>
      (timestamp - timestampValues[index]!) / 1000,
    ))
    : undefined;
  const validTemperatures = temperatures.filter(Number.isFinite);
  const readingHashes = sequences.map((reading) => hash(reading));
  return {
    id: input.id,
    shipmentId: input.shipmentId,
    status: "insufficient_evidence",
    readingCount: sequences.length,
    firstReadingAt: sequences[0]?.timestamp,
    lastReadingAt: sequences.at(-1)?.timestamp,
    minimumTemperatureCelsius: validTemperatures.length ? Math.min(...validTemperatures) : undefined,
    maximumTemperatureCelsius: validTemperatures.length ? Math.max(...validTemperatures) : undefined,
    averageTemperatureCelsius: validTemperatures.length
      ? Math.round((validTemperatures.reduce((sum, temperature) => sum + temperature, 0) / validTemperatures.length) * 100) / 100
      : undefined,
    excursionCount,
    longestExcursionSeconds,
    missingSequenceCount,
    ...(maximumObservedGapSeconds !== undefined ? { maximumObservedGapSeconds } : {}),
    coverageComplete: false,
    evidenceIntegrityValid,
    signatureCoverage,
    hashChainValid,
    documents: input.documents,
    readingsHash: hash({ shipmentId: input.shipmentId, readings: sequences, documents: input.documents }),
    telemetryMerkleRoot: merkleRoot(readingHashes),
    createdAt: input.createdAt,
  };
}

/** Completes the report only after receipt closes the dispatch-to-delivery window. */
export function assessConditionCoverage(
  report: ConditionReport,
  policy: AcceptancePolicy,
  shipment: Shipment,
  lotExpiryDate: string,
  receivedAt?: string,
): void {
  const maxGap = policy.maxTelemetryGapSeconds;
  const dispatchedAt = new Date(shipment.dispatchedAt).valueOf();
  const firstReadingAt = report.firstReadingAt ? new Date(report.firstReadingAt).valueOf() : Number.NaN;
  const lastReadingAt = report.lastReadingAt ? new Date(report.lastReadingAt).valueOf() : Number.NaN;
  const receiptTime = receivedAt ? new Date(receivedAt).valueOf() : Number.NaN;
  const gapMs = maxGap * 1000;
  report.coverageComplete = Boolean(
    receivedAt &&
    report.evidenceIntegrityValid &&
    report.readingCount >= 2 &&
    Number.isFinite(maxGap) && maxGap > 0 &&
    Number.isFinite(dispatchedAt) && Number.isFinite(firstReadingAt) &&
    Number.isFinite(lastReadingAt) && Number.isFinite(receiptTime) &&
    firstReadingAt <= dispatchedAt + gapMs &&
    lastReadingAt <= receiptTime &&
    lastReadingAt >= receiptTime - gapMs &&
    report.maximumObservedGapSeconds !== undefined &&
    report.maximumObservedGapSeconds <= maxGap,
  );
  if (!report.coverageComplete) {
    report.status = "insufficient_evidence";
    return;
  }
  const shelfLifeDays = Math.floor((new Date(lotExpiryDate).valueOf() - receiptTime) / 86_400_000);
  if (
    report.minimumTemperatureCelsius === undefined ||
    report.maximumTemperatureCelsius === undefined ||
    report.minimumTemperatureCelsius < policy.minTemperatureCelsius ||
    report.maximumTemperatureCelsius > policy.maxTemperatureCelsius ||
    shelfLifeDays < policy.minShelfLifeDays
  ) {
    report.status = "exception";
    return;
  }
  report.status = "pass";
}
