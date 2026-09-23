import { BANANA_CHOCOLATE_CHIPS_PRICE_SGD } from "./pricing.js";

export function buildOrderRecord({ form, menu, estimatedTotal, moneyFormatter }) {
  const lineItems = menu
    .map((item) => ({
      productId: item.id,
      quantity: Number(form.items[item.id] || 0),
    }))
    .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
  const selectedItems = menu
    .map((item) => {
      const quantity = Number(form.items[item.id] || 0);
      if (quantity <= 0) return null;
      const description = item.orderDescription ? ` (${item.orderDescription})` : "";
      return `${item.name}${description} x${quantity}`;
    })
    .filter(Boolean);

  const bananaQuantity = Number(form.items?.["banana-bread"] || 0);
  if (form.bananaChocolateChips && bananaQuantity > 0) {
    selectedItems.push(
      `Chocolate chips for Banana Cake x${bananaQuantity} (+S$${
        bananaQuantity * BANANA_CHOCOLATE_CHIPS_PRICE_SGD
      })`
    );
  }

  const items = selectedItems.join(", ");

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
    lineItems,
    bananaChocolateChips: form.bananaChocolateChips === true,
    quotedTotalSgd: estimatedTotal,
  };
}

export async function submitOrderRequest(requestId, order, turnstileToken = "") {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, order, turnstileToken }),
    keepalive: true,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    throw new Error(result?.error || "Unable to save order");
  }

  return result;
}
