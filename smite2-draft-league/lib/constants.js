// ─────────────────────────────────────────────────────
// CONSTANTS
// Central source of truth for enums and config values.
// ─────────────────────────────────────────────────────

export const PLAYER_ROLES = ['Solo', 'Jungle', 'Mid', 'Support', 'Carry'];

export const GOD_ROLES = ['Warrior', 'Assassin', 'Mage', 'Guardian', 'Hunter'];

export const GOD_CLASSES = ['Physical', 'Magical'];

export const DRAFT_STATUSES = ['pending', 'active', 'complete'];

export const TEAMS = ['A', 'B'];

export const POINT_RANGE = { min: 0, max: 10 };

// Role badge colors (tailwind classes)
export const ROLE_COLORS = {
  Solo:    'bg-orange-500/15 text-orange-400',
  Jungle:  'bg-green-500/15 text-green-400',
  Mid:     'bg-purple-500/15 text-purple-400',
  Support: 'bg-blue-500/15 text-blue-400',
  Carry:   'bg-red-500/15 text-red-400',
};

export const STATUS_COLORS = {
  pending:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  active:   'bg-green-500/15 text-green-400 border-green-500/30',
  complete: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};
