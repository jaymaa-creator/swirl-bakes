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
  parts.forEach((part) => {
    if (part.type !== "literal") map[part.type] = part.value;
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
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isValidBatchKey(batchKey) {
  return typeof batchKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(batchKey);
}

export function getCurrentBatchKey(now = new Date()) {
  const nowParts = getSingaporeParts(now);
  const todayStart = createSingaporeDate(nowParts.year, nowParts.month, nowParts.day, 0, 0, 0);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nowParts.weekday);
  const daysUntilSaturday = (6 - weekdayIndex + 7) % 7;

  let saturday = addDays(todayStart, daysUntilSaturday);
  const cutoff = createSingaporeDate(
    getSingaporeParts(addDays(saturday, -2)).year,
    getSingaporeParts(addDays(saturday, -2)).month,
    getSingaporeParts(addDays(saturday, -2)).day,
    22,
    0,
    0
  );

  if (now > cutoff) {
    saturday = addDays(saturday, 7);
  }

  const saturdayParts = getSingaporeParts(saturday);
  return `${String(saturdayParts.year)}-${String(saturdayParts.month).padStart(2, "0")}-${String(saturdayParts.day).padStart(2, "0")}`;
}

export function resolveMenuBatchKey({
  requestedBatchKey = "",
  publishedCurrentBatch = "",
  calendar = [],
  availableSnapshotKeys = [],
  now = new Date(),
} = {}) {
  const targetBatchKey = isValidBatchKey(requestedBatchKey) ? requestedBatchKey : getCurrentBatchKey(now);
  const openCalendarKeys = calendar
    .filter((entry) => entry?.open === true && isValidBatchKey(entry.date))
    .map((entry) => entry.date)
    .sort((a, b) => a.localeCompare(b));

  const resolvedCalendarKey = openCalendarKeys.find((date) => date >= targetBatchKey);
  if (resolvedCalendarKey) return resolvedCalendarKey;
  if (openCalendarKeys.length > 0) return targetBatchKey;

  const snapshotKeys = availableSnapshotKeys
    .filter((batchKey) => isValidBatchKey(batchKey))
    .sort((a, b) => a.localeCompare(b));

  const resolvedSnapshotKey = snapshotKeys.find((date) => date >= targetBatchKey);
  if (resolvedSnapshotKey) return resolvedSnapshotKey;

  if (isValidBatchKey(publishedCurrentBatch) && snapshotKeys.includes(publishedCurrentBatch)) {
    return publishedCurrentBatch;
  }

  return targetBatchKey;
}
