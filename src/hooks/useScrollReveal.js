import { useEffect } from "react";

export default function useScrollReveal() {
  useEffect(() => {
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

    const observe = (node) => {
      if (node instanceof Element && node.matches("[data-reveal]") && !node.classList.contains("is-revealed")) {
        observer.observe(node);
      }
    };

    const observeChildren = (node) => {
      observe(node);
      if (node instanceof Element) node.querySelectorAll("[data-reveal]").forEach(observe);
    };

    document.querySelectorAll("[data-reveal]").forEach(observe);

    // The menu is loaded after the page mounts, so observe reveal elements added later too.
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(observeChildren));
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);
}
