import { useState } from "react";

export default function Admin({ contract, role, onSuccess }) {
  const canStaff = role === "ADMIN" || role === "STAFF";
  const canAdmin = role === "ADMIN";

  return (
    <div className="space-y-8 max-w-lg">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
        Admin Panel
      </h2>

      {!canStaff && (
        <p className="text-gray-600 text-sm">Admin panel requires STAFF or ADMIN role.</p>
      )}

      {canStaff && (
        <AddEquipmentCard contract={contract} onSuccess={onSuccess} />
      )}

      {canAdmin && (
        <AddStaffCard contract={contract} onSuccess={onSuccess} />
      )}
    </div>
  );
}

// ── Add Equipment ────────────────────────────────────────────────────────────

function AddEquipmentCard({ contract, onSuccess }) {
  const [id,      setId]      = useState("");
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const tx = await contract.addEquipment(parseInt(id, 10), name.trim());
      await tx.wait();
      setMsg({ text: `Equipment #${id} "${name}" registered.`, ok: true });
      setId("");
      setName("");
      onSuccess();
    } catch (err) {
      setMsg({ text: err.reason ?? err.message, ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Register Equipment">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="number"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="ID"
            required
            min="1"
            className={`${inputCls} w-24`}
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Equipment name"
            required
            className={`${inputCls} flex-1`}
          />
        </div>
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-green-400" : "text-red-400"}`}>
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-sm transition-colors"
        >
          {loading ? "Adding…" : "Add Equipment"}
        </button>
      </form>
    </Card>
  );
}

// ── Add Staff ────────────────────────────────────────────────────────────────

function AddStaffCard({ contract, onSuccess }) {
  const [addr,    setAddr]    = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const tx = await contract.addStaff(addr.trim());
      await tx.wait();
      setMsg({ text: `Staff granted to ${addr.slice(0, 10)}…`, ok: true });
      setAddr("");
      onSuccess();
    } catch (err) {
      setMsg({ text: err.reason ?? err.message, ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Staff Management">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="0x… address to grant staff"
          required
          pattern="^0x[0-9a-fA-F]{40}$"
          title="Valid Ethereum address"
          className={inputCls}
        />
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-green-400" : "text-red-400"}`}>
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded text-sm transition-colors"
        >
          {loading ? "Granting…" : "Add Staff"}
        </button>
      </form>
    </Card>
  );
}

// ── Shared UI ────────────────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
      <h3 className="text-xs uppercase tracking-widest text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

const inputCls =
  "bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none w-full";
