import { useEffect, useRef } from "react";
import CutoffCountdown from "./CutoffCountdown";
import Pill from "./ui/Pill";

export default function LandingSection({ brand }) {
  const heroVideoRef = useRef(null);
  useEffect(() => {
    if (!heroVideoRef.current) return;
    heroVideoRef.current.playbackRate = 0.5;
  }, []);

  return (
    <section
      className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pb-16 sm:pt-16"
      style={{
        background:
          "radial-gradient(circle at 20% 10%, rgba(196,122,58,0.08), transparent 60%)",
      }}
    >
      <div className="relative overflow-hidden rounded-card border border-line bg-surface shadow-card" data-reveal>
        <video
          ref={heroVideoRef}
          src="/hero-video-opt.webm"
          className="h-[490px] w-full object-cover sm:h-auto sm:aspect-[16/9]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero-poster.jpg"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brandBrown/20 via-brandBrown/30 to-brandBrown/45" />
        <div className="absolute inset-0 flex items-end sm:items-center">
          <div className="flex w-full justify-center px-3 pb-3 sm:px-8 sm:pb-0 lg:px-10">
            <div className="w-full rounded-[24px] border border-white/24 bg-white/10 p-4 shadow-[0_16px_40px_rgba(43,33,27,0.2)] backdrop-blur-sm sm:max-w-3xl sm:rounded-[28px] sm:p-6 lg:p-8">
              <div className="mb-4 hidden sm:mb-5 sm:block">
                <img
                  src="/logo.webp"
                  alt="Swirl Girl main logo"
                  className="h-16 w-16 rounded-full object-cover sm:h-20 sm:w-20"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
              <div className="hidden flex-wrap gap-2 sm:flex">
                <Pill>Saturday batch baking</Pill>
                <Pill>Pre-order window each week</Pill>
                <Pill>GrabExpress / Lalamove delivery</Pill>
              </div>
              <h1 className="mt-0 max-w-3xl text-[1.8rem] leading-[0.98] text-white sm:mt-5 sm:text-5xl">
                {brand.tagline}
              </h1>
              <p className="mt-3 max-w-2xl text-[0.88rem] leading-relaxed text-white/95 sm:mt-4 sm:text-[1.12rem]">
                Cinnamon rolls and banana bread, baked fresh every Saturday.
                <br />
                Pre-order by Thursday 10pm.
              </p>
              <CutoffCountdown />
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-white/90 sm:text-sm">
                <span className="rounded-full bg-white/12 px-3 py-1.5">{brand.originLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
