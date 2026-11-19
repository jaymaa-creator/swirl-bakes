import { calculateLineTotalSgd, money } from "../lib/pricing";

export default function MobileOrderItems({ menu, form, addOnTotal, menuStatus, children }) {
  const selected = menu.filter((item) => item.available !== false && Number(form.items[item.id]) > 0);
  return (
    <section id="order-items" tabIndex={-1} className="rounded-card border border-line bg-surface p-4" aria-label="Selected items">
      <h2 className="text-2xl">Your basket</h2>
      {menuStatus === "ready" && selected.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {selected.map((item) => {
            const quantity = form.items[item.id];
            const chips = item.id === "banana-bread" ? addOnTotal : 0;
            return <li key={item.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <div>
                <span className="font-semibold">{quantity} × {item.name}</span>
                {item.orderDescription && <div className="mt-0.5 text-xs text-inkMuted">{item.orderDescription}</div>}
                {chips > 0 && <div className="text-xs text-inkMuted">With chocolate chips</div>}
              </div>
              <span className="shrink-0 font-semibold">{money(calculateLineTotalSgd(item, quantity) + chips)}</span>
            </li>;
          })}
        </ul>
      ) : <p className="mt-2 text-sm text-inkMuted">{menuStatus === "ready" ? "Your basket is empty." : "Checking the current menu and prices."}</p>}
      <details className="mt-1">
        <summary className="cursor-pointer py-3 text-sm font-semibold text-brandBrown underline underline-offset-4">
          Edit items{selected.some((item) => item.id === "banana-bread") ? " and cake extras" : ""}
        </summary>
        {children}
      </details>
    </section>
  );
}
