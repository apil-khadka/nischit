"use client";

import { useState } from "react";

type TabId = "custody" | "telemetry" | "qa";

export function HeroSpecimenArtifact() {
  const [activeTab, setActiveTab] = useState<TabId>("custody");
  const [inspectedStep, setInspectedStep] = useState<number | null>(null);

  return (
    <div className="specimen-card" aria-label="Interactive synthetic example lot record">
      <p role="note" className="sandbox-empty-state">Synthetic interface example only. Names, measurements, timestamps, checksums, and transaction references below are fabricated; no chain transaction is connected.</p>
      <div className="specimen-card-header">
        <div className="specimen-status-group">
          <span className="specimen-status-beacon" aria-hidden="true" />
          <span className="specimen-status-text">Synthetic Example</span>
          <span className="specimen-sep" aria-hidden="true">·</span>
          <span className="specimen-network-label">No live chain data</span>
        </div>
        <div className="specimen-lot-meta">
          <span className="specimen-lot-code">LOT-2026-CAS9-91A2</span>
        </div>
      </div>

      <div className="specimen-product-block">
        <div className="specimen-product-info">
          <h2 className="specimen-product-title">Cas9 Endonuclease (GMP)</h2>
          <p className="specimen-product-sub">Storage: -20°C · 10 mg/mL · 250 Vials</p>
        </div>
        <div className="specimen-status-qa">
          <span className="qa-check-icon">✓</span>
          <span>QA Pass · 99.8%</span>
        </div>
      </div>

      <div className="specimen-tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "custody"}
          className={`specimen-tab ${activeTab === "custody" ? "active" : ""}`}
          onClick={() => setActiveTab("custody")}
        >
          Custody Chain
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "telemetry"}
          className={`specimen-tab ${activeTab === "telemetry" ? "active" : ""}`}
          onClick={() => setActiveTab("telemetry")}
        >
          Cold-Chain IoT
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "qa"}
          className={`specimen-tab ${activeTab === "qa" ? "active" : ""}`}
          onClick={() => setActiveTab("qa")}
        >
          QA Certificate
        </button>
      </div>

      <div className="specimen-tab-content">
        {activeTab === "custody" && (
          <div className="specimen-custody-flow">
            <ol className="specimen-steps-list">
              <li
                className={`specimen-step-item ${inspectedStep === 1 ? "inspected" : ""}`}
                onClick={() => setInspectedStep(inspectedStep === 1 ? null : 1)}
              >
                <span className="step-num done">01</span>
                <div className="step-body">
                  <div className="step-header">
                    <strong>PO Created</strong>
                    <span className="step-time">08:30 UTC</span>
                  </div>
                  <p className="step-desc">250 vials @ $58 · $14,500 escrow funded</p>
                  {inspectedStep === 1 && (
                    <div className="step-drawer">
                      <code>Commitment Hash: 0x7f3c...91a2</code>
                      <span>Buyer: Nischit Lab · Vendor: Reagents Direct</span>
                    </div>
                  )}
                </div>
              </li>

              <li
                className={`specimen-step-item ${inspectedStep === 2 ? "inspected" : ""}`}
                onClick={() => setInspectedStep(inspectedStep === 2 ? null : 2)}
              >
                <span className="step-num done">02</span>
                <div className="step-body">
                  <div className="step-header">
                    <strong>Cold Ingest</strong>
                    <span className="step-time">14:15 UTC</span>
                  </div>
                  <p className="step-desc">Example: 250 units received · Condition awaiting review</p>
                  {inspectedStep === 2 && (
                    <div className="step-drawer">
                      <code>Example receiver record</code>
                      <span>No sensor integration is connected</span>
                    </div>
                  )}
                </div>
              </li>

              <li
                className={`specimen-step-item ${inspectedStep === 3 ? "inspected" : ""}`}
                onClick={() => setInspectedStep(inspectedStep === 3 ? null : 3)}
              >
                <span className="step-num done">03</span>
                <div className="step-body">
                  <div className="step-header">
                    <strong>QA Authorized</strong>
                    <span className="step-time">16:45 UTC</span>
                  </div>
                  <p className="step-desc">Example QA outcome · Human review required</p>
                  {inspectedStep === 3 && (
                    <div className="step-drawer">
                      <code>Example QA reviewer</code>
                      <span>No evidence document is attached</span>
                    </div>
                  )}
                </div>
              </li>

              <li
                className={`specimen-step-item ${inspectedStep === 4 ? "inspected" : ""}`}
                onClick={() => setInspectedStep(inspectedStep === 4 ? null : 4)}
              >
                <span className="step-num settled">04</span>
                <div className="step-body">
                  <div className="step-header">
                    <strong>Escrow Settled</strong>
                    <span className="step-time">16:46 UTC</span>
                  </div>
                  <p className="step-desc">Automated release upon QA Acceptance</p>
                  {inspectedStep === 4 && (
                    <div className="step-drawer">
                      <span>No Solana transaction connected</span>
                      <span>No Tempo settlement connected</span>
                    </div>
                  )}
                </div>
              </li>
            </ol>
          </div>
        )}

        {activeTab === "telemetry" && (
          <div className="specimen-telemetry-view">
            <div className="telemetry-grid">
              <div className="telemetry-cell active-safe">
                <span className="telemetry-label">Storage Temp</span>
                <strong className="telemetry-value safe">-20.4°C</strong>
                <span className="telemetry-sub">-20°C ± 2°C</span>
              </div>
              <div className="telemetry-cell active-safe">
                <span className="telemetry-label">Transit Breaches</span>
                <strong className="telemetry-value safe">0 Excursions</strong>
                <span className="telemetry-sub">36h monitored</span>
              </div>
              <div className="telemetry-cell">
                <span className="telemetry-label">Humidity</span>
                <strong className="telemetry-value">41.8% RH</strong>
                <span className="telemetry-sub">Optimal dry</span>
              </div>
              <div className="telemetry-cell active-safe">
                <span className="telemetry-label">Tamper Seal</span>
                <strong className="telemetry-value safe">Intact</strong>
                <span className="telemetry-sub">RFID #8849-012</span>
              </div>
            </div>

            <div className="telemetry-chart-container">
              <div className="chart-header">
                <span>36-Hour Continuous Cold-Chain Monitor</span>
                <span className="chart-legend">● Safe Band (-22°C to -18°C)</span>
              </div>
              <div className="telemetry-graph-visual">
                <svg viewBox="0 0 400 70" className="telemetry-svg" aria-label="Continuous temperature graph showing -20.4 degrees">
                  <rect x="0" y="15" width="400" height="40" fill="#ecfdf5" />
                  <line x1="0" y1="35" x2="400" y2="35" stroke="#10b981" strokeDasharray="3 3" strokeWidth="1" />
                  <path
                    d="M 0,34 Q 40,32 80,36 T 160,34 T 240,35 T 320,33 T 400,34"
                    fill="none"
                    stroke="#315de8"
                    strokeWidth="2.5"
                  />
                  <circle cx="400" cy="34" r="4" fill="#315de8" />
                </svg>
              </div>
              <div className="chart-footer-labels">
                <span>Departed Supplier (0h)</span>
                <span>Air Freight Transfer (18h)</span>
                <span>Received Central Lab (36h)</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "qa" && (
          <div className="specimen-qa-view">
            <div className="qa-evidence-card">
              <div className="qa-card-head">
                <span className="qa-badge-pass">ASSAY PASSED</span>
                <span className="qa-doc-title">Certificate of Analysis #COA-2026-CAS9</span>
              </div>
              <div className="qa-metrics-table">
                <div className="qa-metric-row">
                  <span>UV-Vis Purity (A260/A280)</span>
                  <strong>1.84 (Spec: 1.80 - 1.90)</strong>
                </div>
                <div className="qa-metric-row">
                  <span>Enzymatic Cleavage Activity</span>
                  <strong>99.8% Cleaved @ 15 min</strong>
                </div>
                <div className="qa-metric-row">
                  <span>Endotoxin Contamination</span>
                  <strong>&lt; 0.01 EU/μg (Limit &lt; 0.05)</strong>
                </div>
                <div className="qa-metric-row">
                  <span>Private Object Reference</span>
                  <code>obj_tenant_qa_8829...f3</code>
                </div>
              </div>
              <div className="qa-signature-block">
                <div className="sig-icon">✓</div>
                <div>
                  <strong>Cryptographically Authorized by QA Lead</strong>
                  <p>Dr. Evelyn Vance · Chief Laboratory Quality Officer</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="specimen-card-footer">
        <div className="specimen-footer-hash">
          <span>Anchor</span>
          <code>No transaction reference</code>
        </div>
        <span className="specimen-verified-status">● Example only</span>
      </div>
    </div>
  );
}
