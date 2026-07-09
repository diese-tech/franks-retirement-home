// Bounds for OCR-ingested per-game stat integers. Model/worker output is
// untrusted; out-of-range values are clamped rather than rejected so one
// garbled cell doesn't block a whole extraction — rows are human-reviewed
// before promotion to canonical StatLines anyway.

export const MAX_KDA = 100; // kills / deaths / assists per game
export const MAX_AMOUNT = 10_000_000; // damage / healing / gold per game

export function clampStat(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(Math.trunc(n), max));
}
