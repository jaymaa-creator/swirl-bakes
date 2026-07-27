import { useEffect, useState } from "react";
import { getNextOrderCutoff } from "../lib/dates";

function getTimeRemaining(now) {
  const cutoff = getNextOrderCutoff(now);
  const milliseconds = Math.max(0, cutoff.getTime() - now.getTime());
  const totalSeconds = Math.floor(milliseconds / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
  };
}

function TimeUnit({ value, label }) {
  return (
    <span className="cutoff-timer__unit">
      <strong>{String(value).padStart(2, "0")}</strong>
      <span>{label}</span>
    </span>
  );
}

export default function CutoffCountdown() {
  const [now, setNow] = useState(() => new Date());
  const remaining = getTimeRemaining(now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="cutoff-timer mt-5" aria-live="polite">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Thursday cut-off</div>
        <div className="cutoff-timer__description mt-1 text-sm font-medium text-white sm:text-base">Reserve by 10pm SGT for this Saturday&apos;s batch.</div>
      </div>
      <div className="flex shrink-0 gap-2" aria-label={`${remaining.days} days, ${remaining.hours} hours, and ${remaining.minutes} minutes remaining`}>
        <TimeUnit value={remaining.days} label="days" />
        <TimeUnit value={remaining.hours} label="hrs" />
        <TimeUnit value={remaining.minutes} label="mins" />
      </div>
    </div>
  );
}
