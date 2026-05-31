export default function RoleFilter({ options, value, onChange }) {
  return (
    <div className="filter-chips" style={{ marginBottom: 0 }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`filter-chip${value === opt ? ' is-active' : ''}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
