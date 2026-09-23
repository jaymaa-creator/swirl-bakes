export const REFERENCE_WAIT_MS = 8000;

// A slow response changes the receipt state, not the underlying order request.
// Keep observing it so a late reference can update the same receipt.
export function watchOrderRequest(request, onUpdate) {
  const timer = setTimeout(() => onUpdate({ status: "delayed" }), REFERENCE_WAIT_MS);
  return Promise.resolve(request).then(
    (result) => onUpdate(result?.orderNumber
      ? { status: "saved", orderNumber: result.orderNumber }
      : { status: "unverified" }),
    () => onUpdate({ status: "unverified" })
  ).finally(() => clearTimeout(timer));
}

export function receiptMessage(receipt) {
  if (!receipt.orderNumber) return receipt.message;
  const [heading, ...lines] = receipt.message.split("\n");
  return [heading, `Order reference: ${receipt.orderNumber}`, ...lines].join("\n");
}
