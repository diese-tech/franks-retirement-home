import { RetroWindow, PixelBadge } from '@/components/ui';

export default function StandingsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <RetroWindow title="STANDINGS.EXE" titleBarColor="yellow">
        <div className="text-center py-12">
          <PixelBadge label="Coming Soon" color="orange" />
          <p className="mt-4 font-ui text-sm uppercase tracking-widest text-gray-500">Standings</p>
          <p className="mt-2 text-xs text-gray-700">
            Standings will appear here once matches have been played and approved.
          </p>
        </div>
      </RetroWindow>
    </div>
  );
}
