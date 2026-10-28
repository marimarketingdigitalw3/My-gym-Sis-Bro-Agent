// Fechas locales en formato YYYY-MM-DD, sin depender de la hora ni del horario de verano.

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function today() {
  return toISO(new Date());
}

function toUTC(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function diffDays(fromISO, toISOStr) {
  return Math.round((toUTC(toISOStr) - toUTC(fromISO)) / 86400000);
}

export function addDays(iso, n) {
  const date = new Date(toUTC(iso) + n * 86400000);
  return date.toISOString().slice(0, 10);
}
