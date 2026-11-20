import { useState } from "react";
import BunProgress, { LoadingWords } from "./BunProgress";

const controls = [
  { key: "buns", label: "Number of buns", unit: "", min: 1, max: 6, step: 1, initial: 3 },
  { key: "height", label: "Hop height", unit: "px", min: 4, max: 48, step: 1, initial: 40 },
  { key: "hop", label: "Time per hop", unit: "s", min: 0.3, max: 1.5, step: 0.05, initial: 0.5 },
  { key: "cross", label: "Time to cross", unit: "s", min: 2, max: 15, step: 0.5, initial: 6 },
];

export default function LoadingPreview() {
  const [values, setValues] = useState(() => {
    const query = new URLSearchParams(location.search);
    return Object.fromEntries(controls.map(({ key, min, max, initial }) => {
      const input = Number(query.get(key));
      const value = key === "buns" ? Math.round(input) : input;
      return [key, value >= min && value <= max ? value : initial];
    }));
  });
  function adjust(key, value) {
    const next = { ...values, [key]: value };
    setValues(next);
    history.replaceState(null, "", "?" + new URLSearchParams(next));
  }
  return <main className="mx-auto max-w-lg px-5 py-12">
    <div className="rounded-2xl border border-line bg-cream px-5 pb-2 pt-8"
      style={{ "--hop-height": values.height + "px", "--hop-time": values.hop + "s", "--crossing": values.cross + "s" }}>
      <LoadingWords />
      <BunProgress count={values.buns} />
    </div>
    <div className="mt-8 grid gap-5">{controls.map(({ key, label, unit, min, max, step }) =>
      <label key={key} className="grid gap-2 text-sm font-medium">
        <span className="flex justify-between">{label}<span>{values[key]} {unit}</span></span>
        <input type="range" min={min} max={max} step={step} value={values[key]}
          onChange={event => adjust(key, Number(event.target.value))} className="w-full accent-brandBrown" />
      </label>)}</div>
    <p className="mt-5 text-xs text-inkMuted">Share this page’s URL to send your settings.</p>
  </main>;
}
