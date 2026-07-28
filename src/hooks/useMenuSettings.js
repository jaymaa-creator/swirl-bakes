import { useEffect, useState } from "react";
import { mergeMenuSettings } from "../lib/menuSettings";

export default function useMenuSettings(baseMenu) {
  const [menu, setMenu] = useState(() => mergeMenuSettings(baseMenu));
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isMounted = true;

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
          setMenu(mergeMenuSettings(baseMenu));
          setStatus("fallback");
        }
      }
    }

    loadMenuSettings();

    return () => {
      isMounted = false;
    };
  }, [baseMenu]);

  return { menu, status };
}
