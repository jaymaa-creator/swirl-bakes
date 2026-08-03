import { useEffect, useState } from "react";
import { mergeMenuSettings } from "../lib/menuSettings";

export default function useMenuSettings(baseMenu) {
  const [menu, setMenu] = useState(() => mergeMenuSettings(baseMenu));
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isMounted = true;
    let retryTimer;
    let attempts = 0;

    async function loadMenuSettings() {
      try {
        const response = await fetch("/api/menu", {
          headers: { Accept: "application/json" },
          cache: "no-store",
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
          if (attempts < 2) {
            attempts += 1;
            retryTimer = window.setTimeout(loadMenuSettings, attempts * 2_000);
            return;
          }
          setMenu(mergeMenuSettings(baseMenu));
          setStatus("fallback");
        }
      }
    }

    loadMenuSettings();

    return () => {
      isMounted = false;
      window.clearTimeout(retryTimer);
    };
  }, [baseMenu]);

  return { menu, status };
}
