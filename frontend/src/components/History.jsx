import { useState } from "react";

export default function History({ history, equipment, onRefresh }) {
  const [filter, setFilter] = useState("");

  const equipMap = Object.fromEntries(equipment.map((e) => [e.id, e.name]));

  const filtered = filter.trim()
    ? history.filter((h) => {
        const q = filter.toLowerCase();
        return (
          h.borrower.toLowerCase().includes(q) ||
          String(h.equipmentId).includes(q) ||
          (equipMap[h.equipmentId] ?? "").toLowerCase().includes(q)
        );
      })
    : history;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Borrow History
        </h2>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-xs bg-gray-900 hover:bg-gray-800 rounded border border-gray-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by address, equipment ID, or name…"
          className="w-full max-w-md bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-600 py-16 text-sm">No records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                {["Equipment", "Borrower", "Borrowed", "Due", "Returned", "Penalty"].map((h) => (
                  <th
                    key={h}
                    className="pb-3 pr-5 text-xs uppercase tracking-widest text-gray-600 font-normal"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-900 hover:bg-gray-900/40 transition-colors"
                >
                  <td className="py-3 pr-5">
                    <span className="text-gray-500 font-mono">#{rec.equipmentId}</span>
                    {equipMap[rec.equipmentId] && (
                      <span className="ml-2 text-white">{equipMap[rec.equipmentId]}</span>
                    )}
                  </td>
                  <td className="py-3 pr-5 font-mono text-xs text-gray-400">
                    {rec.borrower.slice(0, 6)}…{rec.borrower.slice(-4)}
                  </td>
                  <td className="py-3 pr-5 text-xs text-gray-400">
                    {new Date(rec.borrowedAt * 1000).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-5 text-xs text-gray-400">
                    {new Date(rec.dueDate * 1000).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-5 text-xs">
                    {rec.returnedAt ? (
                      <span className="text-green-400">
                        {new Date(rec.returnedAt * 1000).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-yellow-500">Active</span>
                    )}
                  </td>
                  <td className="py-3 text-xs font-mono">
                    {rec.penalty != null ? (
                      rec.penalty > 0n ? (
                        <span className="text-red-400">
                          {(Number(rec.penalty) / 1e18).toFixed(2)} ETH
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
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
