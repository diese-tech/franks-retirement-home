const BAR_COLORS = {
  yellow: 'bg-frh-yellow text-frh-ink',
  blue:   'bg-frh-xp-blue text-white',
  purple: 'bg-frh-purple text-white',
  gray:   'bg-brand-700 text-gray-400',
};

export default function RetroWindow({ title = null, titleBarColor = 'gray', children, className = '' }) {
  const barClass = BAR_COLORS[titleBarColor] ?? BAR_COLORS.gray;

  return (
    <div
      className={`border-2 border-gray-700 shadow-[4px_4px_0px_rgba(0,0,0,0.5)] ${className}`}
    >
      {title && (
        <div className={`flex items-center justify-between px-2 h-6 shrink-0 ${barClass}`}>
          <span className="font-ui text-[10px] uppercase tracking-widest truncate leading-none">
            {title}
          </span>
          <span className="font-mono text-[10px] opacity-40 select-none ml-3 leading-none">
            ─ □ ×
          </span>
        </div>
      )}
      <div className="bg-brand-800 p-4">{children}</div>
    </div>
  );
}
