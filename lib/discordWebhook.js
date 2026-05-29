// Sends embeds to a Discord webhook URL.
// Set DISCORD_TRANSACTIONS_WEBHOOK_URL in env to enable.
// All functions are no-ops if the env var is not set.

const WEBHOOK_URL = process.env.DISCORD_TRANSACTIONS_WEBHOOK_URL;

export async function notifyChangeRequest({ request, team, requesterName }) {
  if (!WEBHOOK_URL) return;

  const typeLabel = request.type === 'ROSTER_ADD' ? '➕ Roster Add' : '➖ Roster Remove';
  const payload = request.payload ?? {};

  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: `${typeLabel} Request — ${team?.tag ?? 'Unknown Team'}`,
        color: request.type === 'ROSTER_ADD' ? 0x8bbf28 : 0xff6b35,
        fields: [
          { name: 'Team', value: team?.name ?? 'Unknown', inline: true },
          { name: 'Player', value: payload.playerName ?? 'Unknown', inline: true },
          { name: 'Role', value: payload.role ?? '—', inline: true },
          { name: 'Requested By', value: requesterName, inline: true },
          { name: 'Reason', value: payload.reason ?? '—', inline: false },
        ],
        footer: { text: 'Pending admin approval · FRH' },
        timestamp: new Date().toISOString(),
      }],
    }),
  });
}
