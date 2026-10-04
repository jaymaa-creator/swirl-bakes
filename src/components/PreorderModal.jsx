import { useState, useEffect, useRef } from "react";
import { formatSgDate, fromSingaporeDateKey, getCutoffForSaturday } from "../lib/dates";
import {
  BANANA_CHOCOLATE_CHIPS_PRICE_SGD,
  calculateAddOnTotalSgd,
  calculateLineTotalSgd,
} from "../lib/pricing";
import Card from "./ui/Card";
import Field from "./ui/Field";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import Textarea from "./ui/Textarea";
import TurnstileWidget from "./TurnstileWidget";
import { getCheckoutIssues } from "../lib/checkoutGuidance";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function PreorderModal({
  open,
  onClose,
  form,
  setForm,
  estimatedTotal,
  itemsTotal,
  addOnTotal,
  deliveryFee,
  isDeliveryEligible,
  waMessage,
  bakeWindowLabel,
  hasSelectedItems,
  hasCurrentPrices,
  canSubmitOrder,
  isBakeWindowOpen,
  menuStatus,
  menu,
  quantityOptions,
  allergenDisclaimer,
  money,
  brand,
  onRetryMenu,
  onOrderIntent,
}) {
  const [allergenAcknowledged, setAllergenAcknowledged] = useState(false);
  const [attemptedCheckout, setAttemptedCheckout] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState("");
  const orderRequestSubmittedRef = useRef(false);
  const isDelivery = form.delivery.toLowerCase().includes("delivery") && isDeliveryEligible;
  const cutoffLabel = form.bakeWindow
    ? `${formatSgDate(getCutoffForSaturday(fromSingaporeDateKey(form.bakeWindow)))}, 10pm SGT`
    : brand.orderCutoffLabel;

  function setItemQuantity(productId, quantity) {
    setForm((current) => {
      const items = { ...current.items, [productId]: quantity };
      const bananaChocolateChips =
        productId === "banana-bread" && Number(quantity) === 0
          ? false
          : current.bananaChocolateChips;
      const nextForm = { ...current, items, bananaChocolateChips };
      const nextItemsTotal = menu.reduce(
        (sum, item) => sum + calculateLineTotalSgd(item, Number(items[item.id] || 0)),
        0
      ) + calculateAddOnTotalSgd(nextForm);
      const mustUseCollection = nextItemsTotal < brand.deliveryMinimumSgd;

      return {
        ...current,
        items,
        bananaChocolateChips,
        delivery: mustUseCollection ? brand.deliveryOptions[1] : current.delivery,
        address: mustUseCollection ? "" : current.address,
      };
    });
  }

  useEffect(() => {
    if (open) {
      orderRequestSubmittedRef.current = false;
    }
  }, [open]);

  const [firstLine, ...rest] = waMessage.split("\n");
  const waMessageWithAck = [
    firstLine,
    "I confirm I have read and understood the allergen disclaimer.",
    "",
    ...rest,
  ].join("\n");
  const issues = getCheckoutIssues({ form, menuStatus, hasSelectedItems, hasCurrentPrices,
    isBakeWindowOpen, isDeliveryEligible, deliveryMinimumSgd: brand.deliveryMinimumSgd,
    allergenAcknowledged, securityRequired: Boolean(TURNSTILE_SITE_KEY), turnstileToken,
    turnstileError, canSubmitOrder });
  const firstIssue = issues[0];
  const fieldInvalid = (id) => attemptedCheckout && firstIssue?.target === id;

  function closeCheckout() {
    setAllergenAcknowledged(false);
    setAttemptedCheckout(false);
    setTurnstileToken("");
    setTurnstileError("");
    onClose();
  }

  function handleWaClick() {
    if (orderRequestSubmittedRef.current) return;
    setAttemptedCheckout(true);
    if (firstIssue) {
      const field = document.getElementById(firstIssue.target);
      field?.focus({ preventScroll: true });
      field?.scrollIntoView({ block: "center", behavior: "auto" });
      return;
    }
    orderRequestSubmittedRef.current = true;
    onOrderIntent?.(waMessageWithAck, turnstileToken);
    setAllergenAcknowledged(false);
    setAttemptedCheckout(false);
    setTurnstileToken("");
  }

  return (
    <>
      <Modal
        open={open}
        onClose={closeCheckout}
        fullScreen
        title="Your order"
        footer={
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm font-semibold"><span>Order total</span><span>{money(estimatedTotal)}</span></div>
            <p id="checkout-guidance" role="status" aria-live="polite" aria-atomic="true" className="text-sm leading-5 text-brandBrown">
              {firstIssue ? `To continue: ${firstIssue.message}` : "Ready to review your order."}
            </p>
            {(menuStatus === "error" || (menuStatus === "ready" && !hasCurrentPrices)) && onRetryMenu ? (
              <button type="button" onClick={onRetryMenu} className="text-left text-sm font-medium text-brandBrown underline">Retry menu</button>
            ) : null}
            <button type="button" onClick={handleWaClick} aria-describedby="checkout-guidance" className="w-full rounded-button bg-brandBrown px-5 py-3 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-brandCinnamon">
              Review order receipt
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <section className="rounded-card border border-line bg-cream p-4 sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brandBrown">1. Your details</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" hint="Required" htmlFor="order-name">
                <Input
                  id="order-name"
                  name="name"
                  required
                  maxLength={80}
                  aria-invalid={fieldInvalid("order-name")}
                  aria-describedby={fieldInvalid("order-name") ? "checkout-guidance" : undefined}
                  autoComplete="name"
                  enterKeyHint="next"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Contact number" hint="Required" htmlFor="order-phone">
                <Input
                  id="order-phone"
                  name="tel"
                  required
                  maxLength={40}
                  aria-invalid={fieldInvalid("order-phone")}
                  aria-describedby={fieldInvalid("order-phone") ? "checkout-guidance" : undefined}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  enterKeyHint="next"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+65 9123 4567"
                />
              </Field>
              <Field label="Saturday batch">
                <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink">
                  {bakeWindowLabel}
                </div>
              </Field>
            </div>
          </section>

          <Card>
            <div id="order-items" tabIndex={-1} className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Items</div>
                  <div className="text-xs text-inkMuted">Set quantities for your Saturday batch reservation.</div>
                </div>
                <div className="text-sm font-semibold">
                  Price: {menuStatus === "ready" ? money(estimatedTotal) : "—"}
                </div>
              </div>
              {menuStatus === "ready" ? (
                <div className="mt-2 text-xs text-inkMuted">
                  Items {money(itemsTotal)}
                  {addOnTotal > 0 ? ` (includes ${money(addOnTotal)} chocolate chips)` : ""}
                  {deliveryFee > 0 ? ` + delivery ${money(deliveryFee)}` : ""}
                </div>
              ) : null}

              {menuStatus !== "ready" ? (
                <div className="mt-3 rounded-2xl border border-line bg-cream px-4 py-3 text-sm text-inkMuted">
                  {menuStatus === "error" ? "The menu couldn't load. Use Retry menu below." : "Loading the current menu and prices..."}
                </div>
              ) : (
                <div className="mt-3 grid gap-3">
                {menu.map((m) => {
                  const quantityChoices = m.quantityOptions || quantityOptions;
                  const isAvailable = m.available !== false;

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col gap-3 rounded-2xl border border-line bg-cream px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                        isAvailable ? "" : "opacity-70"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-ink">{m.name}</div>
                        <div className="text-xs text-inkMuted">
                          {isAvailable ? `${money(m.priceSgd)} ${m.unitLabel || "each"}` : "Sold out for this bake"}
                        </div>
                        {m.id === "banana-bread" && isAvailable ? (
                          <button
                            type="button"
                            disabled={Number(form.items[m.id] || 0) === 0}
                            onClick={() =>
                              setForm((current) => {
                                const nextForm = {
                                  ...current,
                                  bananaChocolateChips: !current.bananaChocolateChips,
                                };
                                const nextItemsTotal = menu.reduce(
                                  (sum, item) =>
                                    sum + calculateLineTotalSgd(item, Number(current.items[item.id] || 0)),
                                  0
                                ) + calculateAddOnTotalSgd(nextForm);
                                const mustUseCollection = nextItemsTotal < brand.deliveryMinimumSgd;

                                return {
                                  ...nextForm,
                                  delivery: mustUseCollection ? brand.deliveryOptions[1] : current.delivery,
                                  address: mustUseCollection ? "" : current.address,
                                };
                              })
                            }
                            className={`mt-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                              form.bananaChocolateChips
                                ? "border-brandBrown bg-brandBrown text-white"
                                : "border-[#DCCEBF] text-inkMuted hover:border-brandCinnamon disabled:cursor-not-allowed disabled:opacity-45"
                            }`}
                            aria-pressed={Boolean(form.bananaChocolateChips)}
                          >
                            Add chocolate chips +{money(BANANA_CHOCOLATE_CHIPS_PRICE_SGD)} per cake
                          </button>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {quantityChoices.map((qty) => {
                          const isSelected = Number(form.items[m.id] || 0) === qty;
                          return (
                            <button
                              key={qty}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() =>
                                setItemQuantity(
                                  m.id,
                                  Number(form.items[m.id] || 0) === qty ? 0 : qty
                                )
                              }
                              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                                isSelected
                                  ? "border-brandBrown bg-brandBrown text-white"
                                  : "border-[#DCCEBF] bg-transparent text-inkMuted hover:border-brandCinnamon disabled:cursor-not-allowed disabled:opacity-45"
                              }`}
                              aria-pressed={isSelected}
                            >
                              {qty} {qty === 1 ? m.quantityLabel || "item" : m.quantityLabelPlural || "items"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                </div>
              )}

            </div>
          </Card>

          <section id="order-delivery" tabIndex={-1} className="rounded-card border border-line bg-cream p-4 sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brandBrown">2. Delivery method</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { value: brand.deliveryOptions[1], label: "Self-collection", detail: "Collect from our agreed pickup point.", enabled: true },
                {
                  value: brand.deliveryOptions[0],
                  label: "Delivery",
                  detail: isDeliveryEligible
                    ? `Flat ${money(brand.deliveryFeeSgd)} delivery fee added at checkout.`
                    : `Available from ${money(brand.deliveryMinimumSgd)} of bakes.`,
                  enabled: isDeliveryEligible,
                },
              ].map((option) => {
                const isSelected = form.delivery === option.value && option.enabled;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!option.enabled}
                    onClick={() => {
                      if (!option.enabled) return;
                      setForm((f) => ({ ...f, delivery: option.value }));
                    }}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-brandBrown bg-surface shadow-soft"
                        : "border-line bg-surface/60 hover:border-brandCinnamon disabled:cursor-not-allowed disabled:opacity-45"
                    }`}
                    aria-pressed={isSelected}
                    aria-disabled={!option.enabled}
                    title={!option.enabled ? `Delivery is available from ${money(brand.deliveryMinimumSgd)} of bakes.` : undefined}
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
              3. {isDelivery ? "Delivery address" : "Collection"}
            </div>
            <div className="mt-4">
              {isDelivery ? (
                <Field label="Your delivery address" hint="Include unit number" htmlFor="order-address">
                  <Input
                    id="order-address"
                    required
                    aria-invalid={fieldInvalid("order-address")}
                    aria-describedby={fieldInvalid("order-address") ? "checkout-guidance" : undefined}
                    name="street-address"
                    autoComplete="street-address"
                    enterKeyHint="next"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Block, street, postal code, unit number"
                  />
                </Field>
              ) : (
                <div id="order-pickup" tabIndex={-1}>
                  <div className="text-sm font-semibold text-ink">Choose a one-hour pickup window</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {brand.pickupWindows.map((pickupWindow) => (
                      <button
                        key={pickupWindow}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, pickupTime: pickupWindow }))}
                        className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                          form.pickupTime === pickupWindow
                            ? "border-brandBrown bg-brandBrown text-white"
                            : "border-[#DCCEBF] bg-surface text-inkMuted hover:border-brandCinnamon"
                        }`}
                        aria-pressed={form.pickupTime === pickupWindow}
                      >
                        {pickupWindow}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-5 text-inkMuted">
                    Exact Joo Chiat handoff details are shared after confirmation.
                  </div>
                </div>
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

          <section className="rounded-card border border-line bg-cream p-4 sm:p-5" aria-labelledby="allergen-heading">
            <h3 id="allergen-heading" className="text-sm font-semibold text-ink">Allergen notice</h3>
            <p id="allergen-notice" className="mt-2 text-xs leading-6 text-inkMuted">{allergenDisclaimer}</p>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm leading-6">
              <input id="order-allergens" type="checkbox" required checked={allergenAcknowledged}
                onChange={(event) => setAllergenAcknowledged(event.target.checked)}
                aria-invalid={fieldInvalid("order-allergens")} aria-describedby="allergen-notice"
                className="mt-1 h-5 w-5 shrink-0 accent-brandBrown" />
              <span>I have read the allergen notice and understand that cross-contamination is possible.</span>
            </label>
          </section>

          <Field label="Referral code" hint="Optional — pickup orders of S$35 or more">
            <Input
              name="referral-code"
              autoComplete="off"
              maxLength={12}
              value={form.referralCode || ""}
              onChange={(e) => setForm((f) => ({ ...f, referralCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
              placeholder="e.g. SWIRL7K2"
            />
          </Field>
          <p className="text-xs leading-5 text-inkMuted">
            Give S$5, get S$5. Valid on a first self-collection order with at least S$35 of bakes. We confirm eligibility when your order is recorded.
          </p>

          <p className="text-xs leading-6 text-inkMuted">
            We use these details to manage your order. Do not include card details, NRIC details, or unnecessary sensitive information. Read our{" "}
            <a href="#privacy" onClick={closeCheckout} className="font-medium text-brandBrown underline underline-offset-2">
              privacy notice
            </a>
            .
          </p>

            {TURNSTILE_SITE_KEY ? (
              <div id="order-security" tabIndex={-1} className="rounded-2xl border border-line bg-cream px-3 py-3">
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
            <div className="rounded-2xl border border-line bg-cream px-4 py-3 text-xs leading-6 text-inkMuted">
              Reservations close {cutoffLabel}. You will receive confirmation, PayNow details, and pickup or dispatch timing before bake day.
            </div>

          <div className="hidden sm:block rounded-2xl border border-line bg-cream p-4 text-xs text-inkMuted whitespace-pre-wrap">
            {allergenAcknowledged ? waMessageWithAck : waMessage}
          </div>
        </div>
      </Modal>

    </>
  );
}
