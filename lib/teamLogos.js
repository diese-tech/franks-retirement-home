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
  BK: TEAM_LOGOS['team-babas-kitchen'],
  CC: TEAM_LOGOS['team-caustic-crusaders'],
  CPO: TEAM_LOGOS['team-cyberpunk-otters'],
  DD: TEAM_LOGOS['team-death-dealers'],
  EE: TEAM_LOGOS['team-exile-extinction'],
  GS: TEAM_LOGOS['team-galactic-stingers'],
  KC: TEAM_LOGOS['team-kappa-corp'],
  TRO: TEAM_LOGOS['team-ruined-order'],
  VV: TEAM_LOGOS['team-valhalla-vikings'],
  WM: TEAM_LOGOS['team-wheezys-mafia'],
};

export function getTeamLogo(team) {
  if (!team) return null;
  return TEAM_LOGOS[team.id] ?? TEAM_TAG_LOGOS[team.tag] ?? null;
}
