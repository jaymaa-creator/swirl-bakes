import { useEffect, useState } from "react";
import { mergeMenuSettings } from "../lib/menuSettings";

export default function useMenuSettings(baseMenu, batchKey) {
  const [menu, setMenu] = useState(() => mergeMenuSettings(baseMenu));
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [menuMeta, setMenuMeta] = useState({ batchKey: "", defaultBatch: "", calendar: [] });

  useEffect(() => {
    let isMounted = true;
    let retryTimer;
    let controller;
    let attempts = 0;

    setStatus("loading");

    async function loadMenuSettings() {
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4_000);
      const query = batchKey ? `?batch=${encodeURIComponent(batchKey)}` : "";

      try {
        const response = await fetch(`/api/menu${query}`, {
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
          setMenuMeta({
            batchKey: typeof settings.batchKey === "string" ? settings.batchKey : batchKey,
            defaultBatch: typeof settings.defaultBatch === "string" ? settings.defaultBatch : "",
            calendar: Array.isArray(settings.calendar) ? settings.calendar : [],
          });
          setStatus("ready");
        }
      } catch {
        if (isMounted) {
          if (attempts < 1) {
            attempts += 1;
            retryTimer = window.setTimeout(loadMenuSettings, 500);
            return;
          }
          setMenu(mergeMenuSettings(baseMenu));
          setStatus("error");
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    loadMenuSettings();

    return () => {
      isMounted = false;
      controller?.abort();
      window.clearTimeout(retryTimer);
    };
  }, [baseMenu, batchKey, reloadKey]);

  return {
    menu,
    status,
    ...menuMeta,
    retry: () => {
      setStatus("loading");
      setReloadKey((key) => key + 1);
    },
  };
}
