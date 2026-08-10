export function buildWhatsAppLink(numberE164, message) {
  const digits = numberE164.replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}

export function buildOrderMessage({
  brandName,
  form,
  menu,
  estimatedTotal,
  itemsTotal = estimatedTotal,
  deliveryFee = 0,
  moneyFormatter,
  orderNumber,
}) {
  const lines = [];
  lines.push(`${brandName} Saturday reservation`);
  if (orderNumber) lines.push(`Order reference: ${orderNumber}`);
  lines.push(`Name: ${form.name || "-"}`);
  lines.push(`Phone: ${form.phone || "-"}`);
  lines.push(`Bake window: ${form.bakeWindow}`);
  lines.push(`Fulfilment: ${form.delivery}`);
  if (form.delivery.toLowerCase().includes("delivery")) {
    lines.push(`Address: ${form.address || "-"}`);
  } else {
    lines.push(`Collection: ${form.pickupTime || "Ready to collect from 11am"}`);
  }
  lines.push("Items:");
  menu.forEach((m) => {
    const qty = Number(form.items[m.id] || 0);
    if (qty > 0) {
      const description = m.orderDescription ? ` (${m.orderDescription})` : "";
      lines.push(`- ${m.name}${description} x${qty}`);
    }
  });
  lines.push(`Items subtotal: ${moneyFormatter(itemsTotal)}`);
  if (deliveryFee > 0) lines.push(`Delivery fee: ${moneyFormatter(deliveryFee)}`);
  lines.push(`Estimated total: ${moneyFormatter(estimatedTotal)}`);
  if (form.notes) lines.push(`Notes: ${form.notes}`);
  lines.push("\nPlease confirm availability and PayNow details.");
  return lines.join("\n");
}
