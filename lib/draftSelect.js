// Whitelist of Draft columns that are safe to expose to non-admin clients.
//
// The three *Key fields (adminKey, captainAKey, captainBKey) are URL auth
// tokens and must never leak in public responses (homepage, GET /api/drafts,
// SSR HTML, etc.). When you need the keys for the admin share modal, fetch
// them from the authenticated /api/drafts/admin endpoint instead.
//
// Keep this list in sync with prisma/schema.prisma::Draft.
export const PUBLIC_DRAFT_SELECT = {
  id: true,
  name: true,
  status: true,
  captainAReady: true,
  captainBReady: true,
  usedGodIds: true,
  version: true,
  createdAt: true,
  updatedAt: true,
};
