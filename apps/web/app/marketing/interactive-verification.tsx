"use client";

import { useState } from "react";

type ProofReceipt = {
  id: string;
  product: string;
  quantity: string;
  site: string;
  status: "accepted" | "held" | "settled";
  amount: string;
  token: string;
  qaOfficer: string;
  qaDate: string;
};

const sampleReceipts: Record<string, ProofReceipt> = {
  "LOT-CAS9-91A2": {
    id: "po_7f3c_91a2",
    product: "Synthetic Reagent Example A",
    quantity: "250 Example Units",
    site: "Example Site A",
    status: "settled",
    amount: "14,500.00",
    token: "TEST_USD",
    qaOfficer: "Synthetic QA Reviewer",
    qaDate: "Sep 22, 2026 · 16:45 UTC",
  },
  "LOT-AMMONIA-7F3C": {
    id: "po_88e1_44bc",
    product: "Synthetic Reagent Example B",
    quantity: "500 Example Units",
    site: "Example Site B",
    status: "accepted",
    amount: "8,920.00",
    token: "TEST_USD",
    qaOfficer: "Synthetic QA Reviewer",
    qaDate: "Sep 20, 2026 · 11:20 UTC",
  },
  "LOT-MAB-4401": {
    id: "po_12d4_99fa",
    product: "Synthetic Reagent Example C",
    quantity: "120 Example Units",
    site: "Example Site C",
    status: "settled",
    amount: "26,400.00",
    token: "TEST_USD",
    qaOfficer: "Synthetic QA Reviewer",
    qaDate: "Sep 19, 2026 · 09:15 UTC",
  },
};

export function InteractiveVerificationSandbox() {
  const [selectedKey, setSelectedKey] = useState<string>("LOT-CAS9-91A2");
  const [queryInput, setQueryInput] = useState<string>("LOT-CAS9-91A2");
  const [verifiedRecord, setVerifiedRecord] = useState<ProofReceipt | null>(sampleReceipts["LOT-CAS9-91A2"] ?? null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSelectSample = (key: string) => {
    setSelectedKey(key);
    setQueryInput(key);
    setIsVerifying(true);
    setTimeout(() => {
      setVerifiedRecord(sampleReceipts[key] ?? null);
      setIsVerifying(false);
    }, 280);
  };

  const handleCustomVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = queryInput.trim().toUpperCase();
    setIsVerifying(true);
    setTimeout(() => {
      if (sampleReceipts[trimmed]) {
        setSelectedKey(trimmed);
        setVerifiedRecord(sampleReceipts[trimmed]);
      } else {
        setSelectedKey("");
        setVerifiedRecord(null);
      }
      setIsVerifying(false);
    }, 320);
  };

  return (
    <section className="verification-sandbox" aria-labelledby="verify-sandbox-heading">
      <div className="sandbox-intro">
        <span className="marketing-eyebrow">SYNTHETIC EXAMPLE</span>
        <h2 id="verify-sandbox-heading">
          Explore an example workflow record.
        </h2>
        <p>
          These preset records are fabricated examples for interface exploration. They are not customer data, chain receipts, or verified records. Other IDs return no result.
        </p>
      </div>

      <div className="sandbox-panel">
        <div className="sandbox-controls">
          <span className="sandbox-presets-label">Sample lots:</span>
          <div className="sandbox-presets">
            {Object.keys(sampleReceipts).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectSample(key)}
                className={`preset-btn ${selectedKey === key ? "active" : ""}`}
              >
                <code>{key}</code>
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomVerify} className="sandbox-input-row">
            <div className="input-wrap">
              <span className="search-prefix" aria-hidden="true">⌕</span>
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Enter lot number or purchase-order ID"
                aria-label="Lot number or purchase-order ID"
              />
            </div>
            <button type="submit" className="sandbox-verify-btn" disabled={isVerifying}>
              {isVerifying ? "Verifying..." : "Verify Receipt"}
            </button>
          </form>
        </div>

        {verifiedRecord && (
          <div className={`sandbox-result ${isVerifying ? "loading" : "ready"}`}>
            <div className="result-header">
              <div className="result-title-group">
                <span className="receipt-badge">
                  <span className="pulse-dot" />
                  SYNTHETIC EXAMPLE — NOT VERIFIED
                </span>
                <h3 className="result-product-title">{verifiedRecord.product}</h3>
                <span className="result-po-id">Internal Commitment ID: <code>{verifiedRecord.id}</code></span>
              </div>
              <div className="result-seal">
                <div className="seal-circle">
                  <span>NISCHIT</span>
                  <strong>SYNTHETIC RECORD</strong>
                </div>
              </div>
            </div>

            <div className="result-grid">
              <div className="result-cell">
                <span className="cell-label">Received Quantity</span>
                <strong className="cell-val">{verifiedRecord.quantity}</strong>
                <span className="cell-sub">{verifiedRecord.site}</span>
              </div>
              <div className="result-cell">
                <span className="cell-label">Quality Review Outcome</span>
                <strong className="cell-val text-emerald">
                  {verifiedRecord.status === "held" ? "Example: Held" : "Example: Accepted"}
                </strong>
                <span className="cell-sub">{verifiedRecord.qaOfficer}</span>
              </div>
              <div className="result-cell">
                <span className="cell-label">Settlement Amount</span>
                <strong className="cell-val">
                  Not executed
                </strong>
                <span className="cell-sub">Example status only; no payment executed</span>
              </div>
              <div className="result-cell">
                <span className="cell-label">Verification Timestamp</span>
                <strong className="cell-val mono">{verifiedRecord.qaDate}</strong>
                <span className="cell-sub">Illustrative timestamp only</span>
              </div>
            </div>

            <div className="result-crypto-bar">
              <div className="crypto-item">
                <span className="crypto-tag">Chain status</span>
                <span>No live transaction is associated with this record.</span>
              </div>
              <div className="crypto-item">
                <span className="crypto-tag">Evidence</span>
                <span>Example metadata only; no document is attached.</span>
              </div>
            </div>

            <div className="result-guarantee-note">
              <span className="shield-icon" aria-hidden="true">🛡</span>
              <p>
                <strong>Synthetic data only:</strong> This interface does not connect to a public receipt verifier or establish a security guarantee.
              </p>
            </div>
          </div>
        )}
        {!verifiedRecord && !isVerifying && (
          <p role="status" className="sandbox-empty-state">No example record matches that ID. Try one of the preset IDs.</p>
        )}
      </div>
    </section>
  );
}
