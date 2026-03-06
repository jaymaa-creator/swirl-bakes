export default function Card({ children }) {
  return (
    <div className="rounded-card border border-line/60 bg-surface shadow-card">
      {children}
    </div>
  );
}
