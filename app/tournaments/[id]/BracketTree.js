'use client';

import { useEffect, useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';

// Bracket Match state -> visual treatment (CONTEXT.md's Ready/Decided
// states). `ready` gets a subtle glow via the `pulse-glow` Tailwind
// animation utility that already exists in tailwind.config.js -- no Framer
// Motion needed for that, just a class keyed off `state` (ADR-0009 only
// calls for Framer Motion on the slide/cross-out, not the glow).
const MATCH_BOX_CLASS = {
  empty: 'border-frh-border/60',
  ready: 'border-frh-lime animate-pulse-glow',
  decided: 'border-frh-border',
};

function roundLabel(roundNumbers, round) {
  const fromEnd = roundNumbers.length - roundNumbers.indexOf(round);
  if (fromEnd === 1) return 'Final';
  if (fromEnd === 2) return 'Semifinals';
  if (fromEnd === 3) return 'Quarterfinals';
  return `Round ${round}`;
}

// The SSE contract ships matches as { id, round, position, slot1, slot2,
// winner, state } -- no nextMatchId/nextMatchSlot pointer (those are
// Phase 0's internal routing fields, not part of the viewer payload). The
// bracket engine builds every round with standard tree math though
// (docs/tournament-bracket-implementation-plan.md), so the next match a
// winner advances into is always deterministic from round/position alone.
function findNextMatch(matches, match) {
  return (
    matches.find(
      (m) => m.round === match.round + 1 && m.position === Math.floor(match.position / 2)
    ) ?? null
  );
}

const slideInVariants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0 },
};

// A participant has exactly one "live" chip at a time -- the one Framer
// Motion tracks with `layout` + a stable `layoutId` keyed by participantId,
// per ADR-0009. It lives wherever their bracket run currently stands: their
// in-progress match if not yet decided, or -- per CONTEXT.md, "the winning
// Participant slides down the bracket line into its next Bracket Match
// slot" -- their next match once they've won and advanced. The match they
// won *from* keeps showing their name too (so the bracket stays a readable
// historical record) but as a plain, non-tracked label: the animated
// instance has moved on, so when the next match's slot mounts a chip with
// the same layoutId, Framer Motion flies it in from the old chip's last
// known position instead of popping it into place.
//
// The losing Participant has no next match, so their chip has nowhere to
// go -- it just renders "in place" forever, struck through, per CONTEXT.md.
function Slot({ participant, isWinner, isLoser, isLive, playInitial }) {
  if (!participant) {
    return (
      <div className="h-8 flex items-center px-2 font-mono text-[11px] text-frh-text-muted/50">
        —
      </div>
    );
  }

  const textClass = [
    'truncate',
    isLoser ? 'line-through text-frh-text-muted' : 'text-frh-text',
    isWinner ? 'font-bold text-frh-yellow' : '',
  ].join(' ');

  const initial = playInitial ? 'hidden' : false;

  if (!isLive) {
    return (
      <motion.div
        initial={initial}
        animate="visible"
        variants={slideInVariants}
        className={`h-8 flex items-center px-2 font-mono text-xs ${textClass}`}
      >
        {participant.name}
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId={`participant-${participant.id}`}
      layout
      initial={initial}
      animate="visible"
      variants={slideInVariants}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.6 }}
      className={`h-8 flex items-center px-2 font-mono text-xs ${textClass}`}
    >
      {participant.name}
    </motion.div>
  );
}

function slotDisplayProps(match, participant, winnerHasAdvanced) {
  if (!participant) return { isWinner: false, isLoser: false, isLive: false };

  const isWinner = match.state === 'decided' && match.winner?.id === participant.id;
  const isLoser = match.state === 'decided' && Boolean(match.winner) && match.winner.id !== participant.id;
  // Winner's animated chip is live here only if there's nowhere further to
  // advance to (they're the tournament champion); otherwise the live chip
  // has moved to the next match, and this slot shows a static label.
  const isLive = isWinner ? !winnerHasAdvanced : true;

  return { isWinner, isLoser, isLive };
}

function MatchBox({ match, matches, playInitial }) {
  const boxClass = MATCH_BOX_CLASS[match.state] ?? MATCH_BOX_CLASS.empty;
  const nextMatch = match.state === 'decided' ? findNextMatch(matches, match) : null;
  const winnerHasAdvanced = match.state === 'decided' && Boolean(nextMatch);

  return (
    <div className={`border-2 bg-frh-surface/40 px-1 py-1 w-44 shrink-0 transition-colors ${boxClass}`}>
      <Slot
        participant={match.slot1}
        playInitial={playInitial}
        {...slotDisplayProps(match, match.slot1, winnerHasAdvanced)}
      />
      <div className="border-t border-frh-border/60" />
      <Slot
        participant={match.slot2}
        playInitial={playInitial}
        {...slotDisplayProps(match, match.slot2, winnerHasAdvanced)}
      />
    </div>
  );
}

export default function BracketTree({ matches }) {
  // Only the very first mount plays the "slide in from the left" initial
  // animation (per the plan: "Initial mount: all participants animate in
  // from the left"). Later SSE-driven updates instead rely on the
  // layoutId-tracked slide described above -- `initial` only has any effect
  // on a chip's own first mount, so re-renders of already-mounted chips
  // ignore this regardless, but newly-appearing static labels (e.g. a match
  // that just became decided) should also just settle in, not replay the
  // page-load slide.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);
  const playInitial = !hasMountedRef.current;

  if (!matches || matches.length === 0) {
    return <p className="text-sm text-frh-text-muted text-center py-8">No bracket yet.</p>;
  }

  const byRound = {};
  for (const match of matches) {
    (byRound[match.round] ??= []).push(match);
  }
  const roundNumbers = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  return (
    <LayoutGroup>
      <div className="flex gap-8 overflow-x-auto pb-4">
        {roundNumbers.map((round) => {
          const roundMatches = [...byRound[round]].sort((a, b) => a.position - b.position);
          return (
            <div key={round} className="flex flex-col justify-around gap-6 shrink-0">
              <p className="font-ui text-[10px] uppercase tracking-widest text-frh-text-muted text-center mb-1">
                {roundLabel(roundNumbers, round)}
              </p>
              {roundMatches.map((match) => (
                <MatchBox key={match.id} match={match} matches={matches} playInitial={playInitial} />
              ))}
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
