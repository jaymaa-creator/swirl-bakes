import { Children, useRef, useState } from "react";

export default function BakeCarousel({ title, date, children }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const count = Children.count(children);

  function goTo(position) {
    const rail = track.current;
    const card = rail.children[position];
    if (!card) return;
    rail.scrollTo({
      left: card.offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  function updatePosition() {
    const rail = track.current;
    const nearest = [...rail.children].reduce((best, card, i) =>
      Math.abs(card.offsetLeft - rail.scrollLeft) < Math.abs(rail.children[best].offsetLeft - rail.scrollLeft) ? i : best, 0);
    setIndex(nearest);
  }

  return (
    <div aria-label={title} role="region" aria-roledescription="carousel">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          {date && <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brandBrown">{date}</p>}
          <h2 className="mt-1 text-3xl leading-tight">{title}</h2>
        </div>
        {count > 1 && <div className="flex shrink-0 gap-1">
          {[-1, 1].map((step) => (
            <button type="button" key={step} aria-label={step < 0 ? "Previous bake" : "Next bake"}
              aria-controls="weekly-bakes" disabled={index + step < 0 || index + step >= count}
              onClick={() => goTo(index + step)}
              className="grid h-11 w-11 place-items-center rounded-full border border-[#D8C6B4] text-brandBrown disabled:opacity-35">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d={step < 0 ? "m14 5-7 7 7 7" : "m10 5 7 7-7 7"} />
              </svg>
            </button>
          ))}
        </div>}
      </div>
      <div id="weekly-bakes" className="bake-rail" ref={track} onScroll={updatePosition}>{children}</div>
      {count > 1 && <p className="mt-2 text-right text-xs text-inkMuted" role="status">Bake {index + 1} of {count}</p>}
    </div>
  );
}
