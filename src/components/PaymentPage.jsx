import { useEffect, useState } from "react";
import PaynowPayment from "./PaynowPayment";
import { receiptPayment, PAYNOW_MOBILE } from "../lib/paynow";
import { buildWhatsAppLink } from "../lib/orderMessaging";

export default function PaymentPage({ testMode = false }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const load = async () => {
      try {
        const response = await fetch("/api/paynow/resolve", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: window.location.hash.slice(1) }), signal: controller.signal });
        const result = await response.json();
        const payment = response.ok && result.ok && receiptPayment({ status: "saved",
          orderNumber: result.paynow?.orderNumber, amountDueSgd: result.paynow?.amountDueSgd, paynow: result.paynow }, undefined, { testMode });
        if (!payment) throw new Error(result.error || "This payment link is invalid or has expired.");
        if (active) setState({ payment });
      } catch (error) { if (active) setState({ error: error.name === "AbortError" ? "Loading took too long. Reopen this link or contact us on WhatsApp." : error.message }); }
      finally { clearTimeout(timer); }
    };
    load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt, testMode]);
  return <main className="min-h-screen bg-cream px-4 py-8 sm:py-14">
    <section className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <div className="text-sm font-semibold text-brandBrown">Swirl Girl · {testMode ? "Test checkout" : "Payment details"}</div>
      <h1 className="mt-4 text-3xl text-ink">Your payment details</h1>
      {state.loading ? <p role="status" className="mt-5">Loading your payment details…</p> : null}
      {state.payment ? <PaynowPayment payment={state.payment} testMode={testMode} /> : null}
      {state.error ? <div className="mt-5" role="alert"><p>{state.error}</p><button type="button" className="mt-4 rounded-full bg-brandBrown px-5 py-3 font-semibold text-white" onClick={() => { setState({ loading: true }); setAttempt(value => value + 1); }}>Try again</button><a className="mt-4 block font-semibold text-brandBrown underline" href={buildWhatsAppLink(PAYNOW_MOBILE, `Please help me check my ${testMode ? "TEST " : ""}order payment link.`)} target="_blank" rel="noopener noreferrer">Ask us on WhatsApp</a></div> : null}
      <a href="/" className="mt-5 block text-center text-sm text-brandBrown underline">Back to menu</a>
    </section>
  </main>;
}
