export default function StatsBar({ equipment }) {
  const total     = equipment.length;
  const available = equipment.filter((e) => e.isAvailable).length;
  const borrowed  = equipment.filter((e) => !e.isAvailable && !e.isOverdue).length;
  const overdue   = equipment.filter((e) => e.isOverdue).length;

  const stats = [
    { label: "Total Equipment", value: total,     color: "text-white"      },
    { label: "Available",       value: available, color: "text-green-400"  },
    { label: "Borrowed",        value: borrowed,  color: "text-blue-400"   },
    { label: "Overdue",         value: overdue,   color: "text-red-400"    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-gray-800">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-gray-900 rounded-lg p-4 border border-gray-800"
        >
          <p className="text-xs uppercase tracking-widest text-gray-500">{s.label}</p>
          <p className={`text-3xl font-bold mt-1 font-mono ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
