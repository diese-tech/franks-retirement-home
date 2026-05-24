const COLOR_CLASSES = {
  yellow: 'border-frh-yellow text-frh-yellow',
  blue:   'border-frh-xp-blue text-frh-xp-blue',
  purple: 'border-frh-purple text-frh-purple',
  lime:   'border-frh-lime text-frh-lime',
  orange: 'border-frh-orange text-frh-orange',
  cream:  'border-frh-cream text-frh-cream',
  gray:   'border-gray-600 text-gray-500',
};

export default function PixelBadge({ label, color = 'gray' }) {
  const colorClass = COLOR_CLASSES[color] ?? COLOR_CLASSES.gray;
  return (
    <span
      className={`inline-flex items-center border rounded-full px-2 py-0.5 font-ui text-[10px] uppercase tracking-widest ${colorClass}`}
    >
      {label}
    </span>
  );
}
