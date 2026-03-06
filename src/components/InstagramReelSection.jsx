import { useEffect, useRef, useState } from "react";

const REEL_PERMALINK =
  "https://www.instagram.com/reel/CtRgv3kpfEI/?utm_source=ig_embed&utm_campaign=loading";

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

export default function InstagramReelSection() {
  const sectionRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const shouldRenderEmbed = isInView;

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
        <div className="text-xs uppercase tracking-[0.2em] text-inkMuted">From The Kitchen</div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Fresh Out Of Saturday Batch</h2>
      </div>

      <div className="mx-auto mt-8 w-full max-w-[430px] rounded-card border border-line bg-surface p-2 shadow-card">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-button bg-cream">
          {!shouldRenderEmbed ? (
            <div className="h-full w-full animate-pulse bg-[linear-gradient(110deg,rgba(196,122,58,0.08),rgba(196,122,58,0.03),rgba(196,122,58,0.08))]" />
          ) : null}

          {shouldRenderEmbed ? (
            <blockquote
              className="instagram-media"
              data-instgrm-permalink={REEL_PERMALINK}
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
              <a href={REEL_PERMALINK}>View this post on Instagram</a>
            </blockquote>
          ) : null}
        </div>
      </div>
    </section>
  );
}
