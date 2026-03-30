function StatusPill({ item }) {
  if (item.isAvailable)
    return (
      <span className="px-2 py-0.5 text-xs bg-green-950 text-green-400 border border-green-900 rounded-full">
        AVAILABLE
      </span>
    );
  if (item.isOverdue)
    return (
      <span className="px-2 py-0.5 text-xs bg-red-950 text-red-400 border border-red-900 rounded-full">
        OVERDUE
      </span>
    );
  return (
    <span className="px-2 py-0.5 text-xs bg-blue-950 text-blue-400 border border-blue-900 rounded-full">
      BORROWED
    </span>
  );
}

export default function Inventory({ equipment, loading, onRefresh }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Equipment Inventory
        </h2>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-xs bg-gray-900 hover:bg-gray-800 rounded border border-gray-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-600 py-16 text-sm">Loading…</p>
      ) : equipment.length === 0 ? (
        <p className="text-center text-gray-600 py-16 text-sm">
          No equipment registered. Add some via the Admin tab.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                {["ID", "Name", "Status", "Current Borrower", "Due Date"].map((h) => (
                  <th
                    key={h}
                    className="pb-3 pr-6 text-xs uppercase tracking-widest text-gray-600 font-normal"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipment.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-900 hover:bg-gray-900/40 transition-colors"
                >
                  <td className="py-3 pr-6 font-mono text-gray-500">#{item.id}</td>
                  <td className="py-3 pr-6 text-white">{item.name}</td>
                  <td className="py-3 pr-6">
                    <StatusPill item={item} />
                  </td>
                  <td className="py-3 pr-6 font-mono text-xs text-gray-500">
                    {item.isAvailable
                      ? "—"
                      : `${item.currentBorrower.slice(0, 6)}…${item.currentBorrower.slice(-4)}`}
                  </td>
                  <td className="py-3 text-xs text-gray-500">
                    {item.isAvailable || item.dueDate === 0
                      ? "—"
                      : new Date(item.dueDate * 1000).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
