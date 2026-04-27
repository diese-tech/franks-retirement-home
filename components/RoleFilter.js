export default function RoleFilter({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase tracking-wider transition-colors ${
            value === opt
              ? 'bg-frost-500/20 text-frost-400 border border-frost-500/40'
              : 'bg-brand-700/50 text-gray-500 border border-transparent hover:text-gray-300'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
