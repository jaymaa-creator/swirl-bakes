export function buildOrderRecord({ form, menu, estimatedTotal, moneyFormatter }) {
  const items = menu
    .map((item) => {
      const quantity = Number(form.items[item.id] || 0);
      if (quantity <= 0) return null;
      const description = item.orderDescription ? ` (${item.orderDescription})` : "";
      return `${item.name}${description} x${quantity}`;
    })
    .filter(Boolean)
    .join(", ");

  return {
    name: form.name,
    phone: form.phone,
    bakeWindow: form.bakeWindow,
    items,
    estimatedTotal: moneyFormatter(estimatedTotal),
    delivery: form.delivery,
    pickupTime: form.delivery.toLowerCase().includes("delivery") ? "" : form.pickupTime,
    address: form.delivery.toLowerCase().includes("delivery") ? form.address : "",
    notes: form.notes,
  };
}

export async function submitOrderRequest(order, turnstileToken = "") {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order, turnstileToken }),
    keepalive: true,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    throw new Error(result?.error || "Unable to save order");
  }

  return result;
}
