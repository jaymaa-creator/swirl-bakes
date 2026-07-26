export default function SiteFooter({ brand }) {
  return (
    <footer className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-inkMuted">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-semibold text-ink">{brand.name}</div>
            <div className="text-xs text-inkMuted">Cinnamon rolls and baked goods - Singapore</div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <a href="#menu" className="hover:text-ink">Menu</a>
              <a href="#how" className="hover:text-ink">How it works</a>
              <a href="#story" className="hover:text-ink">About</a>
              <a href="#privacy" className="hover:text-ink">Privacy</a>
              <a href={brand.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-ink">
                Instagram
              </a>
            </div>
          </div>
          <div className="text-xs text-inkMuted">
            © {new Date().getFullYear()} {brand.name}. Saturday batches, small-batch style.
          </div>
        </div>
      </div>
    </footer>
  );
}
