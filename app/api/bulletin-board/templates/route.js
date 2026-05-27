import { NextResponse } from 'next/server';
import { requireBulletinAdmin } from '@/lib/bulletinAuth';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  {
    type: 'announcement',
    label: 'Announcement',
    titleTemplate: 'League Announcement: [Topic]',
    bodyTemplate: 'Attention all players...\n\n[Details here]',
    description: 'Official league announcements',
  },
  {
    type: 'match_hype',
    label: 'Match Hype',
    titleTemplate: '[Team A] vs [Team B] - Week [X] Preview',
    bodyTemplate: "This week's marquee matchup...\n\nStakes: ...\nKey matchup: ...",
    description: 'Pre-match hype and predictions',
  },
  {
    type: 'player_spotlight',
    label: 'Player Spotlight',
    titleTemplate: 'Player Spotlight: [Player Name]',
    bodyTemplate: 'This week we highlight...\n\nStats: ...\nNotable plays: ...',
    description: 'Featured player highlights',
  },
  {
    type: 'team_roast',
    label: 'Team Roast',
    titleTemplate: 'Roast of the Week: [Team Name]',
    bodyTemplate: 'Oh you thought you were safe?\n\n[Roast content]',
    description: 'Weekly team roasts (all in good fun)',
  },
  {
    type: 'weekly_recap',
    label: 'Weekly Recap',
    titleTemplate: 'Week [X] Recap: [Theme]',
    bodyTemplate: 'This week in FRH...\n\nResults:\n...\n\nHighlights:\n...',
    description: 'End-of-week summaries',
  },
];

// GET /api/bulletin-board/templates
// Admin-only: returns available post templates.
export async function GET(request) {
  const authError = requireBulletinAdmin(request);
  if (authError) return authError;

  return NextResponse.json(TEMPLATES);
}
