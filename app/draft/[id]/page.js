import prisma from '@/lib/db';
import { cookies } from 'next/headers';
import { resolveRole } from '@/lib/draftAuth';
import { buildDraftState } from '@/lib/draftState';
import { getDiscordSessionUser, resolveDraftRoleFromDiscord } from '@/lib/discordAuth';
import DraftClient from './DraftClient';

export const dynamic = 'force-dynamic';

export default async function DraftPage({ params, searchParams }) {
  const { id } = await params;
  const awaitedSearch = await searchParams;
  const key = awaitedSearch?.key ?? null;

  let draft = null;
  let dbError = false;
  try {
    draft = await prisma.draft.findUnique({ where: { id } });
  } catch (_) {
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center card">
        <p className="text-red-400 mb-4">Unable to load draft. Database may be unreachable.</p>
        <a href="/" className="btn-secondary text-xs">&larr; Back Home</a>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center card">
        <p className="text-red-400 mb-4">Draft not found</p>
        <a href="/" className="btn-secondary text-xs">← Back Home</a>
      </div>
    );
  }

  let role = 'spectator';
  let effectiveKey = key;

  // Try Discord session first
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => c.name + '=' + c.value).join('; ');
  const fakeReq = { headers: { get: (h) => h === 'cookie' ? cookieHeader : null } };
  const discordSession = getDiscordSessionUser(fakeReq);

  if (discordSession) {
    const discordRole = await resolveDraftRoleFromDiscord(draft.id, discordSession.roles);
    if (discordRole !== 'spectator') {
      role = discordRole;
      effectiveKey = key || null;
    } else {
      role = resolveRole(key, draft);
    }
  } else {
    role = resolveRole(key, draft);
  }

  let state = null;
  try {
    state = await buildDraftState(id);
  } catch (_) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center card">
        <p className="text-red-400 mb-4">Unable to load draft state. Database may be unreachable.</p>
        <a href="/" className="btn-secondary text-xs">&larr; Back Home</a>
      </div>
    );
  }

  return (
    <DraftClient
      initialState={JSON.parse(JSON.stringify(state))}
      role={role}
      draftKey={effectiveKey}
    />
  );
}
