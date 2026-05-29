const TEAM_LOGOS = {
  'team-babas-kitchen': '/team-logos/babas-kitchen.png',
  'team-caustic-crusaders': '/team-logos/caustic-crusaders.png',
  'team-cyberpunk-otters': '/team-logos/cyberpunk-otters.png',
  'team-death-dealers': '/team-logos/death-dealers.png',
  'team-exile-extinction': '/team-logos/exile-extinction.png',
  'team-galactic-stingers': '/team-logos/galactic-stingers.png',
  'team-kappa-corp': '/team-logos/kappa-corp.png',
  'team-ruined-order': '/team-logos/ruined-order.png',
  'team-valhalla-vikings': '/team-logos/valhalla-vikings.png',
  'team-wheezys-mafia': '/team-logos/wheezys-mafia.png',
};

const TEAM_TAG_LOGOS = {
  BABA: TEAM_LOGOS['team-babas-kitchen'],
  CSTC: TEAM_LOGOS['team-caustic-crusaders'],
  CYBR: TEAM_LOGOS['team-cyberpunk-otters'],
  DEAD: TEAM_LOGOS['team-death-dealers'],
  EXIL: TEAM_LOGOS['team-exile-extinction'],
  GLXS: TEAM_LOGOS['team-galactic-stingers'],
  KAPA: TEAM_LOGOS['team-kappa-corp'],
  RUIN: TEAM_LOGOS['team-ruined-order'],
  VALK: TEAM_LOGOS['team-valhalla-vikings'],
  WHZY: TEAM_LOGOS['team-wheezys-mafia'],
};

export function getTeamLogo(team) {
  if (!team) return null;
  return TEAM_LOGOS[team.id] ?? TEAM_TAG_LOGOS[team.tag] ?? null;
}
