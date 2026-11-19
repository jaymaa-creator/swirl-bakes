export default function BakeQuantity({ item, choices, quantity, onChange }) {
  const unit = (item.quantityLabel || "item").split(" (")[0];
  const current = choices.indexOf(quantity);
  if (!choices.length) return null;
  if (!quantity) {
    const article = /^[aeiou]/i.test(unit) ? "an" : "a";
    return <button type="button" className="min-h-11 rounded-full bg-brandBrown px-5 text-sm font-semibold text-white"
      onClick={() => onChange(choices[0])}>Add {choices[0] === 1 ? article : choices[0]} {unit}</button>;
  }
  return <div className="inline-flex items-center rounded-full border border-brandBrown text-brandBrown" aria-label={item.name} role="group">
    <button type="button" className="h-11 w-11 text-lg" aria-label={`Remove one ${unit} of ${item.name}`}
      onClick={() => onChange(choices[current - 1] || 0)}>−</button>
    <span className="min-w-5 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
    <button type="button" className="h-11 w-11 text-lg disabled:opacity-30" aria-label={`Add one ${unit} of ${item.name}`}
      disabled={current >= choices.length - 1} onClick={() => onChange(choices[current + 1])}>+</button>
  </div>;
}
