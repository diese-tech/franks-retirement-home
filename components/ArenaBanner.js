export default function ArenaBanner({ team, subtext, gold = false }) {
  if (gold) {
    return (
      <div className="border-l-4 border-gold-400 pl-5 py-2">
        <div className="font-display font-black text-3xl uppercase tracking-wider leading-none text-gold-400">
          {subtext}
        </div>
      </div>
    );
  }

  const isA = team === 'A';
  return (
    <div className={`border-l-4 pl-5 py-2 ${isA ? 'border-blue-400' : 'border-red-400'}`}>
      <div className={`font-display font-black text-3xl uppercase tracking-wider leading-none ${isA ? 'text-blue-400' : 'text-red-400'}`}>
        Team {isA ? 'Alpha' : 'Bravo'}
      </div>
      <div className="text-gray-500 font-display text-xs uppercase tracking-widest mt-1">
        {subtext}
      </div>
    </div>
  );
}
