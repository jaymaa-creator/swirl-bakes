export default function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-xs text-inkMuted">
      {children}
    </span>
  );
}
