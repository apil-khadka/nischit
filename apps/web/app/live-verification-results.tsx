import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import styles from "./live-verification-results.module.css";

export type ChainVerificationResult = {
  rail: "tempo" | "solana";
  status: "verified" | "pending" | "failed" | "mismatch" | "unavailable" | "unverifiable";
  reference?: string;
  network?: string;
  event?: string;
  block?: string;
  slot?: string;
  confirmations?: number;
  detail: string;
};
export type LiveVerificationPair = { tempo: ChainVerificationResult; solana: ChainVerificationResult };

export function LiveVerificationResults({ results }: {
  results: LiveVerificationPair;
}) {
  return (
    <section className={styles.results} aria-labelledby="live-verification-heading">
      <Heading id="live-verification-heading" level={3}>Live network checks</Heading>
      <Text as="p" type="supporting">Read-only checks against the configured RPC endpoints. Each rail is verified independently.</Text>
      <div className={styles.grid}>
        {(["tempo", "solana"] as const).map((rail) => (
          <RailResult key={rail} rail={rail} result={results[rail]} />
        ))}
      </div>
    </section>
  );
}

function RailResult({ rail, result }: { rail: ChainVerificationResult["rail"]; result: ChainVerificationResult }) {
  const statusStyle = result.status === "verified" ? styles.success
    : result.status === "pending" ? styles.pending
      : ["unavailable", "unverifiable"].includes(result.status) ? styles.neutral : styles.error;
  const fields: Array<[string, string | number | undefined]> = [
    ["Network", result.network],
    ["Escrow event", result.event],
    ["Block", result.block],
    ["Slot", result.slot],
    ["Confirmations", result.confirmations],
    ["Transaction", result.reference],
  ];

  return (
    <article className={styles.card}>
      <div className={styles.topline}>
        <h4>{rail === "tempo" ? "Tempo escrow" : "Solana memo"}</h4>
        <span className={`${styles.status} ${statusStyle}`}>{result.status}</span>
      </div>
      <p>{result.detail}</p>
      {fields.filter(([, value]) => value !== undefined).map(([label, value]) => (
        <div className={styles.field} key={label}>
          <span>{label}</span>
          <code>{value}</code>
        </div>
      ))}
    </article>
  );
}
