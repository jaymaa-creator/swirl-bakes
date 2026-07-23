import { useEffect } from "react";

export default function useScrollReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!nodes.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.15,
      }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}
