export default function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
            active === t.key
              ? 'bg-blue-900 text-white dark:bg-blue-600'
              : 'bg-gray-100 dark:bg-[#1a1f2e] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2e3650]'
          }`}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}
