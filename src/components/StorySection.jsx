import Card from "./ui/Card";

export default function StorySection({ brand }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-18">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="p-6 sm:p-8" data-reveal="left">
            <div className="text-xs uppercase tracking-[0.22em] text-inkMuted">About Swirl Girl</div>
            <h2 className="mt-3 text-3xl text-ink sm:text-4xl">Saturday bakes from Joo Chiat.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-inkMuted sm:text-[1rem]">
              {brand.story}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-card border border-line bg-cream px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-inkMuted">Collection</div>
                <div className="mt-2 text-base font-semibold text-ink">{brand.collectionLocation}</div>
                <p className="mt-2 text-sm leading-6 text-inkMuted">{brand.collectionNote}</p>
              </div>
              <div className="rounded-card border border-line bg-cream px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-inkMuted">Instagram</div>
                <div className="mt-2 text-base font-semibold text-ink">{brand.instagramHandle}</div>
                <a
                  href={brand.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-brandBrown underline decoration-brandCinnamon/50 underline-offset-4"
                >
                  See latest bakes and kitchen updates
                </a>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-5">
          <Card>
            <div className="p-6" data-reveal="right">
              <div className="text-xs uppercase tracking-[0.22em] text-inkMuted">Ingredients</div>
              <h3 className="mt-3 text-2xl text-ink">Ingredient notes</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-inkMuted">
                {brand.ingredients.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-2.5 w-2.5 rounded-full bg-brandCinnamon" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <div className="p-6" data-reveal="right">
              <div className="text-xs uppercase tracking-[0.22em] text-inkMuted">Collection Notes</div>
              <h3 className="mt-3 text-2xl text-ink">Pickup notes</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-inkMuted">
                {brand.pickupInstructions.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-2.5 w-2.5 rounded-full bg-brandBrown" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
