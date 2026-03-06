export default function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-ink">{label}</label>
        {hint ? <span className="text-xs text-inkMuted">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
