export default function SiteFooter({ brand }) {
  return (
    <footer className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-inkMuted">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold text-ink">{brand.name}</div>
            <div className="text-xs text-inkMuted">Cinnamon rolls and baked goods - Singapore</div>
          </div>
          <div className="text-xs text-inkMuted">© {new Date().getFullYear()} {brand.name}. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
