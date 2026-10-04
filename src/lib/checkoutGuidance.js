// Keep explanations next to checkout, and use the same list to guard submission.
export function getCheckoutIssues({ form, menuStatus, hasSelectedItems, hasCurrentPrices,
  isBakeWindowOpen, isDeliveryEligible, deliveryMinimumSgd, allergenAcknowledged,
  securityRequired, turnstileToken, turnstileError, canSubmitOrder }) {
  if (menuStatus !== "ready") return [{ target: "order-items", message: menuStatus === "error"
    ? "The menu couldn't load. Retry the menu to continue."
    : "The menu and prices are loading. Please wait." }];
  const issues = [];
  const add = (target, message) => issues.push({ target, message });
  if (!form.name.trim()) add("order-name", "Enter your name.");
  else if (form.name.trim().length > 80) add("order-name", "Keep your name to 80 characters or fewer.");
  const phoneDigits = form.phone.replace(/\D/g, "");
  if (!form.phone.trim()) add("order-phone", "Enter your WhatsApp number.");
  else if (phoneDigits.length < 8 || phoneDigits.length > 15 || form.phone.trim().length > 40) {
    add("order-phone", "Enter a valid WhatsApp number (8–15 digits, including country code if needed).");
  }
  if (!hasSelectedItems) add("order-items", "Choose at least one bake.");
  if (!hasCurrentPrices) add("order-items", "Prices aren't available. Retry the menu to continue.");
  if (!isBakeWindowOpen) add("order-items", "This batch is closed. Go back to the menu and choose an open batch.");
  const isDelivery = form.delivery.toLowerCase().includes("delivery");
  if (isDelivery && !isDeliveryEligible) add("order-delivery", `Delivery needs at least S$${deliveryMinimumSgd} of bakes. Choose self-collection or add more bakes.`);
  if (isDelivery && !form.address.trim()) add("order-address", "Enter your delivery address.");
  if (!isDelivery && !form.pickupTime.trim()) add("order-pickup", "Choose a pickup window.");
  if (!allergenAcknowledged) add("order-allergens", "Read and tick the allergen acknowledgement.");
  if (securityRequired && (!turnstileToken || turnstileError)) add("order-security", turnstileError || "Complete the security check.");
  // Fail closed if an additional parent gate is introduced without guidance.
  if (!issues.length && !canSubmitOrder) add("order-items", "Your order isn't ready yet. Check the menu and order details.");
  return issues;
}
