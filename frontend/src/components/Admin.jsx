import { useState, useEffect } from "react";
import { ethers } from "ethers";

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

      <SuccessionPanel contract={contract} />
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
            className={`${inputCls} w-20 flex-none`}
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Equipment name"
            required
            className={`${inputCls} flex-1 min-w-0`}
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
          className={`${inputCls} w-full`}
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

// ── Admin Succession Panel ───────────────────────────────────────────────────

function SuccessionPanel({ contract }) {
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const [lastAction, pending, initiatedAt] = await Promise.all([
        contract.lastAdminAction(),
        contract.pendingAdmin(),
        contract.successionInitiatedAt(),
      ]);
      const INACTIVITY = 30 * 24 * 60 * 60;
      const WINDOW     = 7  * 24 * 60 * 60;
      const now        = Math.floor(Date.now() / 1000);
      const lastTs     = Number(lastAction);
      const inactiveFor = now - lastTs;
      const eligible   = inactiveFor > INACTIVITY;
      const hasPending = pending !== ethers.ZeroAddress;
      const deadline   = hasPending ? Number(initiatedAt) + WINDOW : null;

      setInfo({ lastTs, inactiveFor, eligible, hasPending, pending, deadline });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [contract]);

  const fmt = (secs) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h` : `${h}h`;
  };

  return (
    <div className="border-t border-gray-800 pt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-gray-500">
          Admin Succession — Proof of Stake
        </h3>
        <button
          onClick={load}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {loading ? "loading…" : "refresh"}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs font-mono space-y-2">
        <p className="text-gray-500 leading-relaxed">
          If the admin is inactive for <span className="text-white">30 days</span>, anyone can stake{" "}
          <span className="text-white">1 ETH</span> to initiate succession. The admin has{" "}
          <span className="text-white">7 days</span> to prove they are alive. If they do not respond,
          the challenger claims the admin role and their stake is returned.
        </p>

        {info && (
          <div className="border-t border-gray-800 pt-3 space-y-1.5">
            <Row label="Last admin action" value={new Date(info.lastTs * 1000).toLocaleString()} />
            <Row label="Admin inactive for" value={fmt(info.inactiveFor)} />
            <Row
              label="Succession eligible"
              value={info.eligible ? "YES" : "NO — admin is active"}
              valueClass={info.eligible ? "text-red-400" : "text-green-400"}
            />
            {info.hasPending && (
              <>
                <Row label="Pending challenger" value={`${info.pending.slice(0,8)}…${info.pending.slice(-4)}`} valueClass="text-yellow-400" />
                <Row
                  label="Challenge window closes"
                  value={new Date(info.deadline * 1000).toLocaleString()}
                  valueClass="text-yellow-400"
                />
              </>
            )}
            {!info.hasPending && (
              <Row label="Succession status" value="No challenge in progress" valueClass="text-gray-500" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = "text-white" }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
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
  "bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none";
