import { buildWhatsAppLink } from "../lib/orderMessaging";
import { receiptMessage } from "../lib/orderReceipt";
import CinnamonLoader from "./ui/CinnamonLoader";

export default function OrderReceipt({ receipt, brand, onBrowse, onOpenWhatsApp }) {
  const pending = receipt.status === "pending";
  const saved = receipt.status === "saved";
  return (
    <main className="min-h-screen bg-cream px-4 py-8 sm:py-14">
      <section className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <div className="text-sm font-semibold text-brandBrown">{brand.name}</div>
        <h1 className="mt-4 text-3xl text-ink" tabIndex={-1} autoFocus>Your order request</h1>
        <div className="mt-5 rounded-2xl border border-line bg-cream p-4" role="status">
          <p className="font-semibold text-ink">{saved ? `Reference: ${receipt.orderNumber}` : pending ? "Getting your order reference..." : "Reference not confirmed yet"}</p>
          <p className="mt-2 text-sm leading-6 text-inkMuted">
            {saved
              ? "Your request has been recorded. Send the message below to arrange confirmation and PayNow payment."
              : pending
                ? "Your details are on this receipt. We are checking that your request was recorded."
                : "Recording is taking longer than expected or could not be verified. Please send these details on WhatsApp and ask us to check before placing another order."}
          </p>
          <p className="mt-2 text-xs text-inkMuted">Awaiting bakery confirmation. Payment has not been confirmed.</p>
        </div>
        <dl className="mt-6 grid gap-4 text-sm">
          <div><dt className="text-inkMuted">Bake date</dt><dd className="font-semibold">{receipt.bakeLabel}</dd></div>
          <div><dt className="text-inkMuted">For</dt><dd>{receipt.name}</dd></div>
          <div><dt className="text-inkMuted">Your bakes</dt><dd>{receipt.items}</dd></div>
          <div><dt className="text-inkMuted">Fulfilment</dt><dd>{receipt.delivery}</dd><dd>{receipt.address || receipt.pickupTime}</dd></div>
          {receipt.notes ? <div><dt className="text-inkMuted">Notes</dt><dd>{receipt.notes}</dd></div> : null}
        </dl>
        <div className="mt-6 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><span>Bakes</span><span>{receipt.itemsTotal}</span></div>
          <div className="mt-2 flex justify-between"><span>Delivery</span><span>{receipt.deliveryFee}</span></div>
          <div className="mt-3 flex justify-between text-lg font-semibold"><span>Total</span><span>{receipt.estimatedTotal}</span></div>
        </div>
        {pending ? (
          <div className="mt-6 flex items-center justify-center gap-1 text-sm text-inkMuted sm:gap-3" role="status">
            <CinnamonLoader size={96} className="text-brandBrown" />
            <p className="min-w-0 flex-1 break-words text-center">The WhatsApp link will be available shortly.</p>
            <CinnamonLoader size={96} className="text-brandBrown" />
          </div>
        ) : (
          <a href={buildWhatsAppLink(brand.waNumberE164, receiptMessage(receipt))} target="_blank" rel="noopener noreferrer" onClick={onOpenWhatsApp} className="mt-6 block rounded-button bg-brandBrown px-5 py-3 text-center font-semibold text-white">
            {receipt.whatsappOpened ? "Open WhatsApp again" : "Send via WhatsApp"}
          </a>
        )}
        {receipt.whatsappOpened ? <p className="mt-3 text-sm text-inkMuted">Tap Send in WhatsApp to finish. This page cannot check whether your message was delivered.</p> : null}
        <button type="button" onClick={onBrowse} className="mt-4 w-full rounded-button border border-line px-5 py-3 text-sm">Back to menu</button>
      </section>
    </main>
  );
}
