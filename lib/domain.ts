export const TZ = "Asia/Kolkata";
export const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dateAfter(days: number) {
  const d = new Date(today() + "T12:00:00+05:30");
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
export function slotTime(day: string, hour: number) {
  return new Date(
    `${day}T${String(hour).padStart(2, "0")}:00:00+05:30`,
  ).getTime();
}
export function validSlot(day: string, hour: number, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !HOURS.includes(hour)) return false;
  const time = slotTime(day, hour);
  if (!Number.isFinite(time)) return false;
  const normalized = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
  return normalized === day && time > now && time < now + 60 * 86400000;
}
export function nextBookingDay() {
  return HOURS.some((h) => slotTime(today(), h) > Date.now())
    ? today()
    : dateAfter(1);
}
export function timeLabel(h: number) {
  return `${h % 12 || 12}:00 ${h >= 12 ? "PM" : "AM"}`;
}
export function dayLabel(d: string) {
  return new Date(d + "T12:00:00+05:30").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
}
