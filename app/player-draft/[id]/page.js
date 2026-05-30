import { notFound } from 'next/navigation';
import { buildPlayerDraftState } from '@/lib/playerDraftState';
import { isDiscordAdminFromCookies } from '@/lib/serverAuth';
import { cookies } from 'next/headers';
import { getDiscordSessionFromRaw, DISCORD_SESSION_COOKIE } from '@/lib/discordAuth';
import prisma from '@/lib/db';
import PlayerDraftClient from './PlayerDraftClient';

export const dynamic = 'force-dynamic';

export default async function PlayerDraftPage({ params }) {
  const state = await buildPlayerDraftState(params.id);
  if (!state) notFound();

  const isAdmin = await isDiscordAdminFromCookies();

  // Resolve the viewer's Discord session to find their captainTeamId in this draft
  let captainTeamId = null;
  let isAuthenticated = false;
  try {
    const cookieStore = cookies();
    const rawCookie = cookieStore.get(DISCORD_SESSION_COOKIE)?.value ?? null;
    const session = getDiscordSessionFromRaw(rawCookie);
    if (session) {
      isAuthenticated = true;
      if (!isAdmin) {
        const player = await prisma.player.findFirst({
          where: { discordId: session.discordId },
          select: { id: true },
        });
        if (player) {
          const membership = await prisma.teamMember.findFirst({
            where: {
              playerId: player.id,
              isCaptain: true,
              team: { divisionId: state.draft.divisionId },
            },
            select: { teamId: true },
          });
          captainTeamId = membership?.teamId ?? null;
        }
      }
    }
  } catch {
    // session errors are non-fatal
  }

  // Resolve division teams for the pick order strip
  const divisionTeams = await prisma.team.findMany({
    where: { divisionId: state.draft.divisionId },
    select: { id: true, name: true, tag: true },
    orderBy: { name: 'asc' },
  });

  return (
    <PlayerDraftClient
      draftId={params.id}
      initialState={state}
      isAdmin={isAdmin}
      captainTeamId={captainTeamId}
      divisionTeams={divisionTeams}
      isAuthenticated={isAuthenticated}
    />
  );
}
