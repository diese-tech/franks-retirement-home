/**
 * Lightweight operational logging for captain actions.
 * Outputs structured JSON to console for Vercel log ingestion.
 */
export function captainLog(event, details = {}) {
  const entry = {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  };
  // Use console.info for operational logs (distinct from error/warn)
  console.info('[FRH:captain]', JSON.stringify(entry));
}
