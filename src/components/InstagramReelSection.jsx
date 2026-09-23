import { useEffect, useRef, useState } from "react";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function loadInstagramScriptOnce() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.instgrm?.Embeds) return Promise.resolve();

  if (window.__instagramEmbedPromise) {
    return window.__instagramEmbedPromise;
  }

  window.__instagramEmbedPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("instagram-embed-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Instagram embed script")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "instagram-embed-script";
    script.async = true;
    script.defer = true;
    script.src = "https://www.instagram.com/embed.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Instagram embed script"));
    document.body.appendChild(script);
  });

  return window.__instagramEmbedPromise;
}

function InstagramEmbed({ permalink, shouldRenderEmbed }) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[24px] bg-cream">
      {!shouldRenderEmbed ? (
        <div className="h-full w-full animate-pulse bg-[linear-gradient(110deg,rgba(196,122,58,0.08),rgba(196,122,58,0.03),rgba(196,122,58,0.08))]" />
      ) : null}

      {shouldRenderEmbed ? (
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={permalink}
          data-instgrm-version="14"
          style={{
            background: "transparent",
            border: 0,
            borderRadius: 0,
            boxShadow: "none",
            margin: "0 auto",
            maxWidth: "100%",
            minWidth: "100%",
            width: "100%",
            height: "100%",
          }}
        >
          <a href={permalink}>View this post on Instagram</a>
        </blockquote>
      ) : null}
    </div>
  );
}

export default function InstagramReelSection({ brand }) {
  const sectionRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const feed = brand.instagramFeed || {};
  const embeds = Array.isArray(feed.embeds) ? feed.embeds.filter((item) => item?.permalink) : [];
  const shouldRenderEmbed = isInView && embeds.length > 0;

  useEffect(() => {
    if (!sectionRef.current || isInView) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsInView(true);
        observer.disconnect();
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [isInView]);

  useEffect(() => {
    if (!isInView) return;

    let cancelled = false;
    loadInstagramScriptOnce()
      .then(() => {
        if (!cancelled) setScriptReady(true);
      })
      .catch(() => {
        if (!cancelled) setScriptReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isInView]);

  useEffect(() => {
    if (!shouldRenderEmbed || !scriptReady) return;
    if (!window.instgrm?.Embeds?.process) return;
    window.instgrm.Embeds.process();
  }, [shouldRenderEmbed, scriptReady]);

  return (
    <section
      ref={sectionRef}
      className="mx-auto max-w-6xl px-4 py-12 sm:py-16"
      style={{
        background: "radial-gradient(circle at 50% 0%, rgba(196,122,58,0.08), transparent 58%)",
      }}
    >
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-inkMuted">{feed.heading || "From The Kitchen"}</div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {feed.title || "Fresh out of the oven, straight from Instagram."}
        </h2>
        {feed.intro ? (
          <p className="mt-3 text-sm leading-7 text-inkMuted sm:text-[1rem]">{feed.intro}</p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-card border border-line bg-surface p-2 shadow-card">
          {embeds.length > 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {embeds.map((embed) => (
                <InstagramEmbed
                  key={embed.permalink}
                  permalink={embed.permalink}
                  shouldRenderEmbed={shouldRenderEmbed}
                />
              ))}
            </div>
          ) : embeds.length === 1 ? (
            <InstagramEmbed permalink={embeds[0].permalink} shouldRenderEmbed={shouldRenderEmbed} />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center rounded-[24px] bg-cream px-6 text-center text-sm text-inkMuted">
              Add an Instagram post or reel permalink to show the latest bake here.
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="text-xs uppercase tracking-[0.18em] text-inkMuted">On Instagram</div>
            <div className="mt-2 flex items-center gap-2 text-2xl text-ink">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F7EBDD] text-brandBrown">
                <InstagramIcon />
              </span>
              <span>{brand.instagramHandle}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-inkMuted">
              Follow for new bakes and updates.
            </p>
            <a
              href={brand.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-brandBrown px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-px"
            >
              <InstagramIcon />
              Open Instagram
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
