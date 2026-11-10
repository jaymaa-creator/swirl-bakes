import { useEffect, useState } from "react";
import { renderPaynowImage, savePaynowImage } from "../lib/paynowImage";
import { buildWhatsAppLink } from "../lib/orderMessaging";
import { PAYNOW_MOBILE } from "../lib/paynow";

export default function PaynowPayment({ payment, testMode = false }) {
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    renderPaynowImage(payment.payload).then(dataUrl => {
      if (active) setImage({ payload: payment.payload, dataUrl });
    }).catch(() => { if (active) setError("The QR could not be loaded. Reopen this payment link or contact us on WhatsApp."); });
    return () => { active = false; };
  }, [payment.payload]);
  const dataUrl = image?.payload === payment.payload ? image.dataUrl : "";
  const save = async () => {
    setSaving(true);
    try {
      const result = await savePaynowImage(dataUrl, payment.reference);
      setSaveNotice(result === "downloaded" ? "QR download started. Check Photos or Downloads before opening your bank app."
        : result === "shared" ? "Choose Save Image in the sharing menu to keep the QR in Photos." : "");
    } catch { setSaveNotice("Could not save the QR. Press and hold the image to save it, or take a screenshot."); }
    finally { setSaving(false); }
  };
  return <section className="mt-6 rounded-2xl border border-line bg-cream p-4 sm:p-6" aria-label="PayNow payment">
    <h2 className="text-xl font-semibold text-ink">Pay with PayNow</h2>
    <p className="mt-3 text-3xl font-semibold text-brandBrown">S${payment.amountDueSgd.toFixed(2)}</p>
    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
      <h3 className="font-semibold text-ink">Your order</h3>
      {payment.items?.length ? <ul className="mt-3 space-y-3 text-sm">
        {payment.items.map((item, index) => <li key={index} className="flex items-start justify-between gap-4">
          <span className="min-w-0 break-words">{item.name}</span><span className="shrink-0 font-semibold">× {item.quantity}</span>
        </li>)}
      </ul> : <p className="mt-2 text-sm text-inkMuted">This older payment link does not include the item list. Please refer to your order message on WhatsApp.</p>}
    </div>
    {testMode ? <p className="mt-3 text-sm font-semibold text-brandBrown">TEST order — this QR sends real money. Do not complete a payment just to try it.</p> : null}
    <p className="mt-3 text-sm leading-6 text-inkMuted">Wait for bakery confirmation before paying. Check the recipient and amount in your bank app. Do not pay again if you have already paid, or if your order was cancelled.</p>
    <dl className="mt-4 space-y-2 text-sm">
      <div><dt className="text-inkMuted">Order reference</dt><dd className="break-all font-semibold">{payment.orderNumber}</dd></div>
      <div><dt className="text-inkMuted">Payment reference</dt><dd className="break-all font-semibold">{payment.reference}</dd></div>
      <div><dt className="text-inkMuted">PayNow mobile</dt><dd>+65 8130 7971</dd></div>
    </dl>
    {dataUrl ? <img src={dataUrl} width="640" height="640" className="mx-auto mt-5 h-auto w-full max-w-72 rounded-xl" alt={`PayNow QR for S$${payment.amountDueSgd.toFixed(2)}, payment reference ${payment.reference}`} />
      : <p className="mt-5 text-sm" role="status">{error || "Preparing your QR…"}</p>}
    <button type="button" disabled={!dataUrl || saving} onClick={save} className="mt-5 w-full rounded-button bg-brandBrown px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Opening save options…" : "Save QR"}</button>
    {saveNotice ? <p role="status" className="mt-2 text-sm text-inkMuted">{saveNotice}</p> : null}
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-inkMuted">
      <li>Save the QR to your phone, or take a screenshot.</li>
      <li>Open your bank app, choose Scan &amp; Pay, then select the QR from Photos or Gallery.</li>
      <li>After paying, send a screenshot of the bank confirmation to 8130 7971 on WhatsApp.</li>
    </ol>
    <a href={buildWhatsAppLink(PAYNOW_MOBILE, `${testMode ? "TEST order" : "Order"}: ${payment.orderNumber}\nPayment reference: ${payment.reference}\nAmount: S$${payment.amountDueSgd.toFixed(2)}\nI would like you to check my payment. I will attach the bank confirmation screenshot.`)} target="_blank" rel="noopener noreferrer" className="mt-5 block rounded-button border border-brandBrown px-4 py-3 text-center text-sm font-semibold text-brandBrown">Send payment screenshot via WhatsApp</a>
    <p className="mt-2 text-xs leading-5 text-inkMuted">Attach the screenshot in WhatsApp, then tap Send. Payments are checked manually; this page cannot confirm receipt of money.</p>
  </section>;
}
