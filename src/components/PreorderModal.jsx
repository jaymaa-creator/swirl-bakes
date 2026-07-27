import { useState, useEffect, useRef } from "react";
import { buildWhatsAppLink } from "../lib/orderMessaging";
import Card from "./ui/Card";
import Field from "./ui/Field";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import Select from "./ui/Select";
import Textarea from "./ui/Textarea";
import CinnamonLoader from "./ui/CinnamonLoader";
import TurnstileWidget from "./TurnstileWidget";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function PreorderModal({
  open,
  onClose,
  form,
  setForm,
  estimatedTotal,
  waMessage,
  saturdayDates,
  hasSelectedItems,
  hasRequiredContactDetails,
  canSubmitOrder,
  isBakeWindowOpen,
  menu,
  quantityOptions,
  allergenDisclaimer,
  money,
  brand,
  onOrderIntent,
  onOrderRequest,
}) {
  const [showAllergenPopup, setShowAllergenPopup] = useState(false);
  const [allergenAcknowledged, setAllergenAcknowledged] = useState(false);
  const [allergenCountdown, setAllergenCountdown] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState("");
  const countdownRef = useRef(null);
  const orderRequestSubmittedRef = useRef(false);
  const isDelivery = form.delivery.toLowerCase().includes("delivery");

  useEffect(() => {
    if (showAllergenPopup && allergenCountdown > 0) {
      countdownRef.current = setInterval(() => {
        setAllergenCountdown((n) => {
          if (n <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return n - 1;
        });
      }, 1000);
    } else {
      clearInterval(countdownRef.current);
    }

    return () => clearInterval(countdownRef.current);
  }, [showAllergenPopup, allergenCountdown]);

  useEffect(() => {
    if (open) orderRequestSubmittedRef.current = false;
  }, [open]);

  const [firstLine, ...rest] = waMessage.split("\n");
  const waMessageWithAck = [
    firstLine,
    "I confirm I have read and understood the allergen disclaimer.",
    "",
    ...rest,
  ].join("\n");
  const waLinkWithAck = buildWhatsAppLink(brand.waNumberE164, waMessageWithAck);

  function handleWaClick(e) {
    if (!canSubmitOrder) {
      e.preventDefault();
      return;
    }

    if (!allergenAcknowledged) {
      e.preventDefault();
      setAllergenCountdown(5);
      setShowAllergenPopup(true);
      return;
    }

    e.preventDefault();
    completeOrder();
  }

  function handleAllergenConfirm() {
    setAllergenAcknowledged(true);
    setAllergenCountdown(0);
    setShowAllergenPopup(false);
    completeOrder();
  }

  function handleDismissAllergenPopup() {
    setAllergenCountdown(0);
    setShowAllergenPopup(false);
  }

  function completeOrder() {
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setTurnstileError("Please complete the security check before continuing.");
      return;
    }

    if (!orderRequestSubmittedRef.current) {
      orderRequestSubmittedRef.current = true;
      onOrderRequest?.(turnstileToken);
    }

    onOrderIntent?.(waLinkWithAck);
    window.open(waLinkWithAck, "_blank", "noreferrer");
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Reserve for Saturday"
        footer={
          <div className="grid gap-2">
            {TURNSTILE_SITE_KEY ? (
              <div className="rounded-2xl border border-line bg-cream px-3 py-3">
                <div className="mb-2 text-xs font-medium text-inkMuted">Quick security check</div>
                <TurnstileWidget
                  siteKey={TURNSTILE_SITE_KEY}
                  onTokenChange={(token) => {
                    setTurnstileToken(token);
                    setTurnstileError("");
                  }}
                  onError={() => setTurnstileError("Security check could not load. Please refresh and try again.")}
                />
                {turnstileError ? <div className="mt-2 text-xs text-red-700">{turnstileError}</div> : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={allergenAcknowledged && canSubmitOrder ? waLinkWithAck : undefined}
                onClick={handleWaClick}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!canSubmitOrder}
                tabIndex={canSubmitOrder ? 0 : -1}
                className={`inline-flex justify-center rounded-button bg-brandBrown px-5 py-3 text-sm font-medium text-white shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-float ${
                  canSubmitOrder ? "" : "pointer-events-none opacity-50"
                }`}
              >
                Reserve via WhatsApp
              </a>
            </div>
            <div className="rounded-2xl border border-line bg-cream px-4 py-3 text-xs leading-6 text-inkMuted">
              Reservations close {brand.orderCutoffLabel}. You will receive confirmation, PayNow details, and pickup or dispatch timing before bake day.
            </div>
            {!hasSelectedItems ? (
              <div className="text-xs text-inkMuted">Select at least one item.</div>
            ) : null}
            {!hasRequiredContactDetails ? (
              <div className="text-xs text-inkMuted">Enter your name and WhatsApp number to continue.</div>
            ) : null}
            {hasSelectedItems && !isBakeWindowOpen ? (
              <div className="text-xs text-inkMuted">
                Orders for this batch have closed. Please choose the next available Saturday.
              </div>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4">
          <section className="rounded-card border border-line bg-cream p-4 sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brandBrown">1. Your details</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" hint="Required">
                <Input
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Contact number" hint="WhatsApp preferred, required">
                <Input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+65 ..."
                />
              </Field>
              <Field label="Saturday batch">
                <Select
                  value={form.bakeWindow}
                  onChange={(e) => setForm((f) => ({ ...f, bakeWindow: e.target.value }))}
                >
                  {saturdayDates.map((w) => (
                    <option key={w.value} value={w.value} disabled={!w.isOpen}>
                      {w.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          <Card>
            <div className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Items</div>
                  <div className="text-xs text-inkMuted">Set quantities for your Saturday batch reservation.</div>
                </div>
                <div className="text-sm font-semibold">Estimated: {money(estimatedTotal)}</div>
              </div>

              <div className="mt-3 grid gap-3">
                {menu.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-line bg-cream px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink">{m.name}</div>
                      <div className="text-xs text-inkMuted">{money(m.priceSgd)} {m.unitLabel || "each"}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {quantityOptions.map((qty) => {
                        const isSelected = Number(form.items[m.id] || 0) === qty;
                        return (
                          <button
                            key={qty}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                items: {
                                  ...f.items,
                                  [m.id]: Number(f.items[m.id] || 0) === qty ? 0 : qty,
                                },
                              }))
                            }
                            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                              isSelected
                                ? "border-brandBrown bg-brandBrown text-white"
                                : "border-[#DCCEBF] bg-transparent text-inkMuted hover:border-brandCinnamon"
                            }`}
                            aria-pressed={isSelected}
                          >
                            {qty} {qty === 1 ? m.quantityLabel || "item" : m.quantityLabelPlural || "items"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {allergenDisclaimer ? (
                <div className="mt-3 text-xs text-inkMuted">{allergenDisclaimer}</div>
              ) : null}
            </div>
          </Card>

          <section className="rounded-card border border-line bg-cream p-4 sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brandBrown">2. Delivery method</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { value: brand.deliveryOptions[1], label: "Self-collection", detail: "Collect from our agreed pickup point." },
                { value: brand.deliveryOptions[0], label: "Delivery", detail: "GrabExpress or Lalamove, paid by customer." },
              ].map((option) => {
                const isSelected = form.delivery === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, delivery: option.value }))}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-brandBrown bg-surface shadow-soft"
                        : "border-line bg-surface/60 hover:border-brandCinnamon"
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-inkMuted">{option.detail}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-card border border-line bg-cream p-4 sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brandBrown">
              3. {isDelivery ? "Delivery address" : "Collection time"}
            </div>
            <div className="mt-4">
              {isDelivery ? (
                <Field label="Your delivery address" hint="Include unit number">
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Block, street, postal code, unit number"
                  />
                </Field>
              ) : (
                <Field label="Preferred self-collection slot" hint="We will confirm the exact handoff time">
                  <div className="grid grid-cols-2 gap-3">
                    {["Morning", "Afternoon"].map((slot) => {
                      const isSelected = form.pickupTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, pickupTime: slot }))}
                          className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                            isSelected
                              ? "border-brandBrown bg-brandBrown text-white"
                              : "border-line bg-surface text-inkMuted hover:border-brandCinnamon"
                          }`}
                          aria-pressed={isSelected}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}
            </div>
          </section>

          <Field label="Notes" hint="Allergies, timing constraints, and order details">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
            />
          </Field>

          <p className="text-xs leading-6 text-inkMuted">
            We use these details to manage your order. Do not include card details, NRIC details, or unnecessary sensitive information. Read our{" "}
            <a href="#privacy" onClick={onClose} className="font-medium text-brandBrown underline underline-offset-2">
              privacy notice
            </a>
            .
          </p>

          <div className="hidden sm:block rounded-2xl border border-line bg-cream p-4 text-xs text-inkMuted whitespace-pre-wrap">
            {waMessageWithAck}
          </div>
        </div>
      </Modal>

      {showAllergenPopup ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brandBrown/50" onClick={handleDismissAllergenPopup} />
          <div className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-[0_20px_40px_rgba(90,56,37,0.2)]">
            <div className="text-base font-semibold text-ink">Allergen notice</div>
            <p className="mt-3 text-sm leading-relaxed text-inkMuted">
              Baked in a home kitchen with shared ingredients and tools. Please review the allergen notice carefully before continuing. We cannot guarantee any item is free from cross-contamination.
            </p>
            <div className="mt-4 rounded-2xl border border-line bg-cream p-3 text-xs leading-6 text-inkMuted">
              {allergenDisclaimer}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleAllergenConfirm}
                disabled={allergenCountdown > 0}
                className="relative inline-flex touch-manipulation items-center justify-center rounded-button bg-brandBrown px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-float disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allergenCountdown > 0 ? (
                  <span className="flex items-center gap-2">
                    <CinnamonLoader size={16} className="text-white" />
                    Please read… ({allergenCountdown}s)
                  </span>
                ) : "I understand, continue"}
              </button>
              <button
                onClick={handleDismissAllergenPopup}
                className="inline-flex justify-center rounded-button border border-line bg-surface px-5 py-2.5 text-sm font-medium text-inkMuted hover:bg-cream"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
