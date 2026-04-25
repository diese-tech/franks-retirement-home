export const PLAYER_ROLES = ['Solo', 'Jungle', 'Mid', 'Support', 'Carry', 'Fill'];

export const GOD_ROLES = ['Warrior', 'Assassin', 'Mage', 'Guardian', 'Hunter'];

export const GOD_CLASSES = ['Physical', 'Magical'];

// All valid status values; 'active' kept for backward compat with old drafts
export const DRAFT_STATUSES = ['pending', 'lobby', 'banning', 'picking', 'complete', 'active'];

export const TEAMS = ['A', 'B'];

// Role badge colors (tailwind classes)
export const ROLE_COLORS = {
  Solo:    'bg-orange-500/15 text-orange-400',
  Jungle:  'bg-green-500/15 text-green-400',
  Mid:     'bg-purple-500/15 text-purple-400',
  Support: 'bg-blue-500/15 text-blue-400',
  Carry:   'bg-red-500/15 text-red-400',
  Fill:    'bg-gray-500/15 text-gray-400',
};

export const STATUS_COLORS = {
  pending:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  lobby:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  banning:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  picking:  'bg-green-500/15 text-green-400 border-green-500/30',
  active:   'bg-green-500/15 text-green-400 border-green-500/30',
  complete: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export const CHAT_TEAM_COLORS = {
  A:         'text-blue-400',
  B:         'text-red-400',
  admin:     'text-gold-400',
  spectator: 'text-gray-500',
};
