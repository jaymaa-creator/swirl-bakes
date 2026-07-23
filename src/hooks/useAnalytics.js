import { useEffect } from "react";

function appendScript({ id, src, async = true, attributes = {} }) {
  if (document.getElementById(id)) return;

  const script = document.createElement("script");
  script.id = id;
  script.src = src;
  script.async = async;

  Object.entries(attributes).forEach(([key, value]) => {
    script.setAttribute(key, value);
  });

  document.head.appendChild(script);
}

export default function useAnalytics() {
  useEffect(() => {
    const gaId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
    if (gaId) {
      appendScript({
        id: "ga4-script",
        src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`,
      });

      if (!window.dataLayer) {
        window.dataLayer = [];
      }

      window.gtag =
        window.gtag ||
        function gtag() {
          window.dataLayer.push(arguments);
        };

      window.gtag("js", new Date());
      window.gtag("config", gaId);
    }

    const clarityId = import.meta.env.VITE_CLARITY_PROJECT_ID;
    if (clarityId && !window.clarity) {
      window.clarity =
        window.clarity ||
        function clarity() {
          (window.clarity.q = window.clarity.q || []).push(arguments);
        };

      appendScript({
        id: "clarity-script",
        src: `https://www.clarity.ms/tag/${clarityId}`,
      });
    }

    const cloudflareToken = import.meta.env.VITE_CLOUDFLARE_BEACON_TOKEN;
    if (cloudflareToken) {
      appendScript({
        id: "cloudflare-beacon-script",
        src: "https://static.cloudflareinsights.com/beacon.min.js",
        attributes: {
          defer: "true",
          "data-cf-beacon": JSON.stringify({ token: cloudflareToken }),
        },
      });
    }
  }, []);
}
