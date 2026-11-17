export function comingSaturday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value = type => parts.find(p=>p.type===type).value;
  const day = new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate()+(6-day.getUTCDay()+7)%7);
  return day.toISOString().slice(0,10);
}
