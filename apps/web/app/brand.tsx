export function NischitMark({ className = "landing-brand-mark" }: { className?: string }) {
  return (
    <span className="brand-mark-frame">
      <img className={className} src="/brand/nischit-mark.png" alt="Nischit emblem" />
    </span>
  );
}

export function NischitBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="landing-brand">
      <NischitMark />
      {!compact && (
        <span className="brand-text-block">
          <strong className="brand-name">Nischit</strong>
          <small className="brand-tagline">Trust what you can trace.</small>
        </span>
      )}
    </span>
  );
}
