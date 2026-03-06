import { useMemo } from "react";
import { buildOrderMessage, buildWhatsAppLink } from "../lib/orderMessaging";
import { calculateLineTotalSgd, money } from "../lib/pricing";

export default function useOrderSummary({ form, menu, brandName, waNumberE164 }) {
  const lineTotals = useMemo(
    () =>
      Object.fromEntries(
        menu.map((m) => {
          const qty = Number(form.items[m.id] || 0);
          return [m.id, calculateLineTotalSgd(m, qty)];
        })
      ),
    [form.items, menu]
  );

  const estimatedTotal = useMemo(
    () => Object.values(lineTotals).reduce((sum, lineTotal) => sum + Number(lineTotal || 0), 0),
    [lineTotals]
  );

  const hasSelectedItems = useMemo(
    () => menu.some((m) => Number(form.items[m.id] || 0) > 0),
    [form.items, menu]
  );

  const waMessage = useMemo(
    () =>
      buildOrderMessage({
        brandName,
        form,
        menu,
        estimatedTotal,
        moneyFormatter: money,
      }),
    [brandName, form, menu, estimatedTotal]
  );

  const waLink = useMemo(
    () => buildWhatsAppLink(waNumberE164, waMessage),
    [waNumberE164, waMessage]
  );

  return { estimatedTotal, hasSelectedItems, waMessage, waLink, money };
}
