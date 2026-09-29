import React from "react";
import { SectionIntro } from "./marketing-primitives";

export interface ComparisonRow {
  feature: string;
  legacy: string;
  nischit: React.ReactNode;
}

const DEFAULT_COMPARISONS: ComparisonRow[] = [
  {
    feature: "Purchase Order",
    legacy: "Terms may be spread across emails and attachments.",
    nischit: (
      <>
        <strong>Versioned purchase terms</strong> recorded with the order.
      </>
    ),
  },
  {
    feature: "Dock Receiving",
    legacy: "Receipt details can live in separate site records.",
    nischit: (
      <>
        <strong>Site-bound receiving records</strong> with condition evidence and lot details.
      </>
    ),
  },
  {
    feature: "Quality Assurance",
    legacy: "QA review may be disconnected from the delivery record.",
    nischit: (
      <>
        <strong>Role-checked QA decision</strong> with a recorded reason.
      </>
    ),
  },
  {
    feature: "Settlement",
    legacy: "Settlement is handled in a separate finance process.",
    nischit: (
      <>
        <strong>Settlement state follows the workflow.</strong> Real payment rails need explicit configuration.
      </>
    ),
  },
  {
    feature: "Audit Readiness",
    legacy: "Recall and audit context may require manual reconciliation.",
    nischit: (
      <>
        <strong>Recorded lot and site quantities</strong> support a scoped recall view.
      </>
    ),
  },
];

export function ComparisonTable({
  rows = DEFAULT_COMPARISONS,
}: {
  rows?: ComparisonRow[];
}) {
  return (
    <section className="marketing-section comparison-section" aria-labelledby="comparison-heading">
      <SectionIntro
        id="comparison-heading"
        eyebrow="Current capabilities"
        title={
          <>
            Keep connected records <em>in one workflow.</em>
          </>
        }
      >
        The table describes records represented by the current implementation. It does not claim measured time or cost savings.
      </SectionIntro>

      <p className="comparison-table-scroll-note">Swipe horizontally to view all columns.</p>
      <div className="comparison-table-wrapper" role="region" aria-label="Current capabilities comparison" tabIndex={0}>
        <table className="comparison-table">
          <thead>
            <tr>
              <th scope="col" className="comp-feature-col">
                Handoff Stage
              </th>
              <th scope="col" className="comp-legacy-col">
                Separate tools and records
              </th>
              <th scope="col" className="comp-nischit-col">
                Nischit workflow
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature}>
                <td className="comp-feature">{row.feature}</td>
                <td className="comp-legacy">{row.legacy}</td>
                <td className="comp-nischit">{row.nischit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
