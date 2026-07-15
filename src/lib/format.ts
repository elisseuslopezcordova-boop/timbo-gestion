export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const MESES_COR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const arsFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatARS(n: number | string | null | undefined): string {
  return arsFmt.format(Number(n) || 0);
}

export function formatSigned(n: number): string {
  return (n >= 0 ? "+ " : "- ") + formatARS(Math.abs(n));
}

export function formatCompact(n: number): string {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e6) return "$" + (v / 1e6).toFixed(1).replace(".", ",") + "M";
  if (a >= 1e3) return "$" + Math.round(v / 1e3) + "k";
  return "$" + v;
}

// Fecha de "hoy" en horario de Argentina (GMT-3), como YYYY-MM-DD.
export function todayStr(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const monthOf = (f: string | null | undefined): string => (f || "").slice(0, 7);

export function monthLabel(k: string): string {
  const [y, m] = k.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

export function monthShort(k: string): string {
  const [y, m] = k.split("-");
  return `${MESES_COR[Number(m) - 1]} ${String(y).slice(2)}`;
}

export function shiftMonth(k: string, delta: number): string {
  const [y, m] = k.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
