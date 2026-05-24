export const PLAYER_ROLES = ['Solo', 'Jungle', 'Mid', 'Support', 'Carry', 'Fill'];

export const GOD_ROLES = ['Warrior', 'Assassin', 'Mage', 'Guardian', 'Hunter'];

export const GOD_CLASSES = ['Physical', 'Magical'];

// All valid status values
export const DRAFT_STATUSES = ['pending', 'lobby', 'banning', 'picking', 'complete'];

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

export const CHAT_TEAM_COLORS = {
  A:         'text-blue-400',
  B:         'text-red-400',
  admin:     'text-gold-400',
  spectator: 'text-gray-500',
};
