import Card from "./ui/Card";
import Field from "./ui/Field";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import Select from "./ui/Select";
import Textarea from "./ui/Textarea";

export default function PreorderModal({
  open,
  onClose,
  form,
  setForm,
  estimatedTotal,
  waLink,
  waMessage,
  saturdayDates,
  hasSelectedItems,
  canSubmitOrder,
  isBakeWindowOpen,
  menu,
  money,
  brand,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reserve for Saturday"
      footer={
        <div className="grid gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={canSubmitOrder ? waLink : undefined}
              onClick={(e) => {
                if (!canSubmitOrder) e.preventDefault();
              }}
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
            <button
              onClick={() => {
                navigator.clipboard?.writeText(waMessage);
              }}
              disabled={!canSubmitOrder}
              className="inline-flex justify-center rounded-button border border-line bg-surface px-5 py-3 text-sm font-medium text-brandBrown shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:border-brandCinnamon hover:bg-cream disabled:transform-none"
            >
              Copy order text
            </button>
          </div>
          {!hasSelectedItems ? (
            <div className="text-xs text-inkMuted">Select at least one item.</div>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
            />
          </Field>
          <Field label="Phone" hint="WhatsApp preferred">
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+65 ..."
            />
          </Field>
          <Field label="Email" hint="Optional">
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@email.com"
            />
          </Field>
          <Field label="Saturday batch">
            <Select
              value={form.bakeWindow}
              onChange={(e) => {
                const nextBakeWindow = e.target.value;
                setForm((f) => ({ ...f, bakeWindow: nextBakeWindow }));
              }}
            >
              {saturdayDates.map((w) => (
                <option key={w.value} value={w.value} disabled={!w.isOpen}>
                  {w.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

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
                    <div className="text-xs text-inkMuted">{money(m.priceSgd)} each</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          items: {
                            ...f.items,
                            [m.id]: Math.max(0, Number(f.items[m.id] || 0) - 1),
                          },
                        }))
                      }
                      className="h-9 w-9 rounded-xl border border-line bg-surface text-ink hover:bg-[#F1E8DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCinnamon/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      aria-label={`Decrease ${m.name}`}
                    >
                      -
                    </button>
                    <Input
                      value={String(form.items[m.id] || 0)}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "");
                        setForm((f) => ({
                          ...f,
                          items: { ...f.items, [m.id]: v === "" ? 0 : Number(v) },
                        }));
                      }}
                      className="w-16 text-center"
                    />
                    <button
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          items: {
                            ...f.items,
                            [m.id]: Number(f.items[m.id] || 0) + 1,
                          },
                        }))
                      }
                      className="h-9 w-9 rounded-xl border border-line bg-surface text-ink hover:bg-[#F1E8DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCinnamon/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      aria-label={`Increase ${m.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-inkMuted">
              If pricing is listed as TBC, confirm final amount on WhatsApp before payment.
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fulfilment">
            <Select
              value={form.delivery}
              onChange={(e) => setForm((f) => ({ ...f, delivery: e.target.value }))}
            >
              {brand.deliveryOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Area">
            <Select
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
            >
              {brand.pickupAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {form.delivery.toLowerCase().includes("delivery") ? (
          <Field label="Delivery address" hint="Include unit number">
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Address"
            />
          </Field>
        ) : null}

        <Field label="Notes" hint="Allergies, timing constraints, and order details">
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional"
          />
        </Field>

        <div className="rounded-2xl border border-line bg-cream p-4 text-xs text-inkMuted whitespace-pre-wrap">
          {waMessage}
        </div>

        <div className="text-xs text-inkMuted">
          Optional upgrade later: replace WhatsApp submission with a server endpoint that writes to Google Sheets/Airtable and triggers confirmation + payment link.
        </div>
      </div>
    </Modal>
  );
}
