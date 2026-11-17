import { receiptPayment } from "./paynow.js";

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
          ...(result.paynow ? { paynow: result.paynow } : {}),
          amountDueSgd: Number.isFinite(Number(result.amountDueSgd)) ? Number(result.amountDueSgd) : undefined }
      : { status: "unverified" }),
    (error) => onUpdate(["ORDER_UNAVAILABLE", "PRICE_CHANGED"].includes(error?.code)
      ? { status: "rejected", errorCode: error.code }
      : { status: "unverified" })
  ).finally(() => clearTimeout(timer));
}

export function receiptMessage(receipt, { testMode = false } = {}) {
  const payment = receiptPayment(receipt, undefined, { testMode });
  if (!payment) return "";
  const [heading, ...lines] = receipt.message.split("\n");
  const confirmed = [];
  if (Number.isFinite(receipt.amountDueSgd)) confirmed.push(`Confirmed amount due: S$${receipt.amountDueSgd.toFixed(2)}`);
  if (receipt.referralCode) confirmed.push(`Your referral code: ${receipt.referralCode}`);
  const detailLines = Number.isFinite(receipt.amountDueSgd)
    ? lines.filter((line) => !/^Estimated total:/i.test(line))
    : lines;
  const paymentLines = payment ? [`Payment QR${testMode ? " (TEST)" : ""}: ${payment.url}`, ""] : [];
  const messageLines = payment ? detailLines.filter(line => line !== "Please confirm availability and PayNow details.") : detailLines;
  return [...paymentLines, testMode ? `TEST ONLY — ${heading}` : heading, `Order reference: ${receipt.orderNumber}`, ...confirmed, ...messageLines, ...(payment ? ["", "Please confirm my order before I pay. Payment will be checked manually."] : [])].join("\n");
}
