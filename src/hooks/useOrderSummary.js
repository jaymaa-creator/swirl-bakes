import { useMemo } from "react";
import { buildOrderMessage, buildWhatsAppLink } from "../lib/orderMessaging";
import { calculateLineTotalSgd, money } from "../lib/pricing";

export default function useOrderSummary({
  form,
  menu,
  brandName,
  waNumberE164,
  deliveryMinimumSgd,
  deliveryFeeSgd,
}) {
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

  const itemsTotal = useMemo(
    () => Object.values(lineTotals).reduce((sum, lineTotal) => sum + Number(lineTotal || 0), 0),
    [lineTotals]
  );
  const isDelivery = form.delivery.toLowerCase().includes("delivery");
  const isDeliveryEligible = itemsTotal >= deliveryMinimumSgd;
  const deliveryFee = isDelivery && isDeliveryEligible ? deliveryFeeSgd : 0;
  const estimatedTotal = itemsTotal + deliveryFee;

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
        itemsTotal,
        deliveryFee,
        estimatedTotal,
        moneyFormatter: money,
      }),
    [brandName, form, menu, itemsTotal, deliveryFee, estimatedTotal]
  );

  const waLink = useMemo(
    () => buildWhatsAppLink(waNumberE164, waMessage),
    [waNumberE164, waMessage]
  );

  return {
    itemsTotal,
    deliveryFee,
    estimatedTotal,
    isDeliveryEligible,
    hasSelectedItems,
    waMessage,
    waLink,
    money,
  };
}
