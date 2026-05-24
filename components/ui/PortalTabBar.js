'use client';

export default function PortalTabBar({ tabs, activeTab, onChange }) {
  return (
    <div className="flex border-b-2 border-brand-600">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            'px-4 py-2 font-ui text-xs uppercase tracking-widest transition-colors',
            activeTab === tab.id
              ? 'text-frh-yellow border-b-[3px] border-frh-yellow -mb-[2px]'
              : 'text-gray-500 hover:text-frh-cream',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
