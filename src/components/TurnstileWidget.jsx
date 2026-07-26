import { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function TurnstileWidget({ siteKey, onTokenChange, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
    onErrorRef.current = onError;
  }, [onError, onTokenChange]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    let cancelled = false;
    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !turnstile) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "light",
          size: "flexible",
          action: "order",
          callback: (token) => onTokenChangeRef.current(token),
          "expired-callback": () => onTokenChangeRef.current(""),
          "error-callback": () => {
            onTokenChangeRef.current("");
            onErrorRef.current?.();
          },
        });
      })
      .catch(() => onErrorRef.current?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey]);

  return <div ref={containerRef} />;
}
