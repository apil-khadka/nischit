import React from "react";

export interface StandardItem {
  code: string;
  name: string;
}

const DEFAULT_STANDARDS: StandardItem[] = [
  { code: "TERMS", name: "Recorded before shipment" },
  { code: "EVIDENCE", name: "Private object references" },
  { code: "QA", name: "Human decision required" },
  { code: "DATA", name: "No patient records" },
];

export function StandardsBanner({
  title = "Product boundaries",
  standards = DEFAULT_STANDARDS,
}: {
  title?: string;
  standards?: StandardItem[];
}) {
  return (
    <section className="standards-banner" aria-label="Product boundaries">
      <div className="standards-inner">
        <span className="standards-title">{title}</span>
        <div className="standards-list">
          {standards.map((item, index) => (
            <React.Fragment key={item.code}>
              {index > 0 && <span className="standard-separator" aria-hidden="true">·</span>}
              <div className="standard-item">
                <span className="standard-code">{item.code}</span>
                <span className="standard-name">{item.name}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
