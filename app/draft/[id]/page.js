import prisma from '@/lib/db';
import { resolveRole } from '@/lib/draftAuth';
import { buildDraftState } from '@/lib/draftState';
import DraftClient from './DraftClient';

export const dynamic = 'force-dynamic';

export default async function DraftPage({ params, searchParams }) {
  const { id } = await params;
  const key = searchParams?.key ?? null;

  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center card">
        <p className="text-red-400 mb-4">Draft not found</p>
        <a href="/" className="btn-secondary text-xs">← Back Home</a>
      </div>
    );
  }

  const role = resolveRole(key, draft);
  const state = await buildDraftState(id);

  return (
    <DraftClient
      initialState={JSON.parse(JSON.stringify(state))}
      role={role}
      draftKey={key}
    />
  );
}
