const SINGAPORE_TIMEZONE = "Asia/Singapore";

function getSingaporeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SINGAPORE_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = {};
  parts.forEach((p) => {
    if (p.type !== "literal") map[p.type] = p.value;
  });

  return {
    weekday: map.weekday,
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function createSingaporeDate(year, month, day, hour = 0, minute = 0, second = 0) {
  const y = String(year);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setTime(next.getTime() + days * 24 * 60 * 60 * 1000);
  return next;
}

const WEEKDAY_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function toSingaporeDateKey(date) {
  const parts = getSingaporeParts(date);
  const y = String(parts.year);
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromSingaporeDateKey(dateKey) {
  if (!dateKey) return null;
  return new Date(`${dateKey}T00:00:00+08:00`);
}

export function getCutoffForSaturday(satDate) {
  const saturdayStart = createSingaporeDate(
    getSingaporeParts(satDate).year,
    getSingaporeParts(satDate).month,
    getSingaporeParts(satDate).day,
    0,
    0,
    0
  );
  const fridayDate = addDays(saturdayStart, -1);
  const fridayParts = getSingaporeParts(fridayDate);
  return createSingaporeDate(fridayParts.year, fridayParts.month, fridayParts.day, 19, 0, 0);
}

export function isSaturdayOpen(satDate, now = new Date()) {
  const cutoff = getCutoffForSaturday(satDate);
  return now < cutoff;
}

export function getNearestOpenSaturday(now = new Date()) {
  const nowParts = getSingaporeParts(now);
  const todayStart = createSingaporeDate(nowParts.year, nowParts.month, nowParts.day, 0, 0, 0);
  const weekdayIndex = WEEKDAY_TO_INDEX[nowParts.weekday];
  const daysUntilSaturday = (6 - weekdayIndex + 7) % 7;

  let candidate = addDays(todayStart, daysUntilSaturday);
  while (!isSaturdayOpen(candidate, now)) {
    candidate = addDays(candidate, 7);
  }

  return candidate;
}

export function getOpenSaturdays(count = 2, now = new Date()) {
  const saturdays = [];
  let candidate = getNearestOpenSaturday(now);

  while (saturdays.length < count) {
    if (isSaturdayOpen(candidate, now)) {
      saturdays.push(candidate);
    }
    candidate = addDays(candidate, 7);
  }

  return saturdays;
}

export function formatSgDate(date) {
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Singapore",
  }).format(date);
}
