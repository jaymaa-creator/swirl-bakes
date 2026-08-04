import { useEffect, useState } from "react";
import { mergeMenuSettings } from "../lib/menuSettings";

export default function useMenuSettings(baseMenu) {
  const [menu, setMenu] = useState(() => mergeMenuSettings(baseMenu));
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let retryTimer;
    let pollTimer;
    let attempts = 0;
    let refreshInFlight = false;

    async function loadMenuSettings({ silent = false } = {}) {
      if (refreshInFlight) return;
      refreshInFlight = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8_000);

      try {
        const response = await fetch("/api/menu", {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        const settings = await response.json().catch(() => null);

        if (!response.ok || settings?.ok !== true) {
          throw new Error(settings?.error || "Menu settings unavailable");
        }

        if (isMounted) {
          setMenu(mergeMenuSettings(baseMenu, settings));
          setStatus("ready");
        }
      } catch {
        if (isMounted) {
          if (!silent && attempts < 1) {
            attempts += 1;
            retryTimer = window.setTimeout(loadMenuSettings, attempts * 2_000);
            return;
          }
          if (!silent) {
            setMenu(mergeMenuSettings(baseMenu));
            setStatus("error");
          }
        }
      } finally {
        refreshInFlight = false;
        window.clearTimeout(timeout);
      }
    }

    loadMenuSettings();
    pollTimer = window.setInterval(() => loadMenuSettings({ silent: true }), 15_000);

    return () => {
      isMounted = false;
      window.clearTimeout(retryTimer);
      window.clearInterval(pollTimer);
    };
  }, [baseMenu, reloadKey]);

  return {
    menu,
    status,
    retry: () => {
      setStatus((current) => (current === "ready" ? "refreshing" : "loading"));
      setReloadKey((key) => key + 1);
    },
  };
}
