export const REFERENCE_WAIT_MS = 8000;

// A slow response changes the receipt state, not the underlying order request.
// Keep observing it so a late reference can update the same receipt.
export function watchOrderRequest(request, onUpdate) {
  const timer = setTimeout(() => onUpdate({ status: "delayed" }), REFERENCE_WAIT_MS);
  return Promise.resolve(request).then(
    (result) => onUpdate(result?.orderNumber
      ? { status: "saved", orderNumber: result.orderNumber,
          referralCode: result.referralCode || "",
          referralDiscountSgd: Number(result.referralDiscountSgd || 0),
          creditRedeemedSgd: Number(result.creditRedeemedSgd || 0),
          amountDueSgd: Number.isFinite(Number(result.amountDueSgd)) ? Number(result.amountDueSgd) : undefined }
      : { status: "unverified" }),
    (error) => onUpdate(["ORDER_UNAVAILABLE", "PRICE_CHANGED"].includes(error?.code)
      ? { status: "rejected", errorCode: error.code }
      : { status: "unverified" })
  ).finally(() => clearTimeout(timer));
}

export function receiptMessage(receipt) {
  if (!receipt.orderNumber) return receipt.message;
  const [heading, ...lines] = receipt.message.split("\n");
  const confirmed = [];
  if (Number.isFinite(receipt.amountDueSgd)) confirmed.push(`Confirmed amount due: S$${receipt.amountDueSgd.toFixed(2)}`);
  if (receipt.referralCode) confirmed.push(`Your referral code: ${receipt.referralCode}`);
  const detailLines = Number.isFinite(receipt.amountDueSgd)
    ? lines.filter((line) => !/^Estimated total:/i.test(line))
    : lines;
  return [heading, `Order reference: ${receipt.orderNumber}`, ...confirmed, ...detailLines].join("\n");
}
