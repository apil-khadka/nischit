import React from "react";
import { SectionIntro } from "./marketing-primitives";

export function HomeBentoGrid() {
  return (
    <section className="marketing-section home-value-section" aria-labelledby="home-value-heading">
      <SectionIntro
        id="home-value-heading"
        eyebrow="Why Nischit"
        title={
          <>
            Keep handoffs visible. <em>Make decisions reviewable.</em>
          </>
        }
      >
        Nischit connects order terms, receipt details, QA decisions, inventory events, and settlement state for review.
      </SectionIntro>

      <div className="bento-grid">
        {/* Bento Card 1: Major Chain of Custody Feature */}
        <article className="bento-card bento-card-large">
          <div className="bento-card-content">
            <span className="bento-badge">Chain of Custody</span>
            <h3>Reviewable operational record</h3>
            <p>
              Record purchase terms, receipt details, condition summaries, QA decisions, and settlement state in one
              workflow.
            </p>
            <div className="bento-flow-visual" aria-hidden="true">
              <div className="bento-flow-node">
                <span className="node-num">01</span>
                <span className="node-label">PO Terms</span>
              </div>
              <span className="node-arrow">→</span>
              <div className="bento-flow-node">
                <span className="node-num">02</span>
                <span className="node-label">Ingest</span>
              </div>
              <span className="node-arrow">→</span>
              <div className="bento-flow-node">
                <span className="node-num">03</span>
                <span className="node-label">QA Review</span>
              </div>
              <span className="node-arrow">→</span>
              <div className="bento-flow-node highlight">
                <span className="node-num">04</span>
                <span className="node-label">Settlement</span>
              </div>
            </div>
            <a href="/product" className="marketing-text-link">
              Inspect record contents →
            </a>
          </div>
        </article>

        {/* Bento Card 2: Role Clarity */}
        <article className="bento-card">
          <div className="bento-card-content">
            <span className="bento-badge">Role Isolation</span>
            <h3>Server-enforced authority</h3>
            <p>
              API role checks keep receiving, QA, and finance actions separate. A QA decision does not become a payment
              confirmation by itself.
            </p>
            <div className="role-flow-strip">
              <span className="role-flow-step">Procurement</span>
              <span className="role-flow-arrow">→</span>
              <span className="role-flow-step">Receiving</span>
              <span className="role-flow-arrow">→</span>
              <span className="role-flow-step">QA Lead</span>
              <span className="role-flow-arrow">→</span>
              <span className="role-flow-step">Finance</span>
            </div>
          </div>
        </article>

        {/* Bento Card 3: Boundary Model */}
        <article className="bento-card">
          <div className="bento-card-content">
            <span className="bento-badge">Data Privacy</span>
            <h3>Private evidence, controlled disclosure</h3>
            <p>
              Evidence files use tenant-scoped object keys. Local evaluation uses synthetic records; no public-chain
              receipt is created unless an operator explicitly configures an adapter.
            </p>
            <div className="crypto-shield-line">
              <span className="shield-icon">✓</span> No patient records
            </div>
          </div>
        </article>

        {/* Bento Card 4: Settlement state */}
        <article className="bento-card bento-card-wide">
          <div className="bento-card-content">
            <div className="bento-header-split">
              <div>
                <span className="bento-badge">Settlement state</span>
                <h3>Disbursement follows evidence</h3>
                <p>
                  QA decisions constrain the next allowed settlement action. Local verification uses deterministic
                  adapters; external payment execution requires separate authorization and configuration.
                </p>
              </div>
              <div className="bento-stat-callout">
                <strong>Human</strong>
                <span>decision remains required</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
