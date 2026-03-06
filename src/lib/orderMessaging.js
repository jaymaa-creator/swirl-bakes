export function buildWhatsAppLink(numberE164, message) {
  const digits = numberE164.replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}

export function buildOrderMessage({ brandName, form, menu, estimatedTotal, moneyFormatter }) {
  const lines = [];
  lines.push(`${brandName} Saturday reservation`);
  lines.push(`Name: ${form.name || "-"}`);
  lines.push(`Phone: ${form.phone || "-"}`);
  if (form.email) lines.push(`Email: ${form.email}`);
  lines.push(`Bake window: ${form.bakeWindow}`);
  lines.push(`Fulfilment: ${form.delivery}`);
  lines.push(`Area: ${form.area}`);
  if (form.delivery.toLowerCase().includes("delivery")) {
    lines.push(`Address: ${form.address || "-"}`);
  }
  lines.push("Items:");
  menu.forEach((m) => {
    const qty = Number(form.items[m.id] || 0);
    if (qty > 0) lines.push(`- ${m.name} x${qty}`);
  });
  lines.push(`Estimated total: ${moneyFormatter(estimatedTotal)} (excluding delivery)`);
  if (form.notes) lines.push(`Notes: ${form.notes}`);
  lines.push("\nPlease confirm availability and PayNow details.");
  return lines.join("\n");
}
