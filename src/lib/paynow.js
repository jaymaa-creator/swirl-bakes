export const PAYNOW_TEST_HOST = "test-swirl-girl.jaemcd95.workers.dev";
export const PAYNOW_PRODUCTION_HOST = "swirlgirl.sg";
export const PAYNOW_MOBILE = "+6581307971";

export function amountToCents(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 999999.99) return null;
  const cents = Math.round(amount * 100);
  return Math.abs(amount * 100 - cents) < 0.000001 ? cents : null;
}

export function crc16(value) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id, value) {
  if (typeof value !== "string" || !/^[\x20-\x7E]{1,99}$/.test(value)) throw new Error("Invalid QR field");
  return id + String(value.length).padStart(2, "0") + value;
}

export function createPaynowPayload(amount, reference) {
  const cents = amountToCents(amount);
  if (cents === null || typeof reference !== "string" || !/^[A-Za-z0-9-]{1,25}$/.test(reference)) throw new Error("Invalid payment details");
  const account = field("00", "SG.PAYNOW") + field("01", "0") + field("02", PAYNOW_MOBILE) + field("03", "0");
  const payload = field("00", "01") + field("01", "12") + field("26", account)
    + field("52", "0000") + field("53", "702") + field("54", (cents / 100).toFixed(2))
    + field("58", "SG") + field("59", "Swirl Girl") + field("60", "Singapore")
    + field("62", field("01", reference)) + "6304";
  return payload + crc16(payload);
}

export function receiptPayment(receipt, now = Date.now(), { testMode = false } = {}) {
  const payment = receipt?.paynow;
  if (receipt?.status !== "saved" || !payment || payment.orderNumber !== receipt.orderNumber
      || amountToCents(receipt.amountDueSgd) === null || payment.amountDueSgd !== receipt.amountDueSgd
      || !Number.isSafeInteger(payment.expiresAt) || payment.expiresAt * 1000 <= now) return null;
  try {
    const url = new URL(payment.url);
    if (!(testMode ? /^TEST-[A-Za-z0-9-]{1,75}$/ : /^SG-[A-Za-z0-9-]{1,75}$/).test(payment.orderNumber)
        || url.origin !== `https://${testMode ? PAYNOW_TEST_HOST : PAYNOW_PRODUCTION_HOST}` || url.pathname !== "/pay" || url.search
        || !/^#(?:s\.[A-Za-z0-9_-]{22}|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43})$/.test(url.hash)
        || payment.payload !== createPaynowPayload(payment.amountDueSgd, payment.reference)) return null;
    return payment;
  } catch { return null; }
}
