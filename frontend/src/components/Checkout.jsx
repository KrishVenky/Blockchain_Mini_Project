import { useState } from "react";

export default function Checkout({ contract, role, onSuccess }) {
  const [equipmentId, setEquipmentId] = useState("");
  const [borrower, setBorrower]       = useState("");
  const [duration, setDuration]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [success, setSuccess]         = useState(null);

  const canAct = role === "ADMIN" || role === "STAFF";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const tx = await contract.checkout(
        parseInt(equipmentId, 10),
        borrower.trim(),
        parseInt(duration, 10)
      );
      await tx.wait();
      setSuccess(`Equipment #${equipmentId} checked out to ${borrower.slice(0, 8)}…`);
      setEquipmentId("");
      setBorrower("");
      setDuration("");
      onSuccess();
    } catch (err) {
      setError(err.reason ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!canAct) {
    return (
      <p className="text-gray-600 text-sm py-12 text-center">
        Checkout requires STAFF or ADMIN role.
      </p>
    );
  }

  return (
    <div className="max-w-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300 mb-6">
        Checkout Equipment
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Equipment ID">
          <input
            type="number"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            placeholder="1"
            required
            min="1"
            className={inputCls}
          />
        </Field>

        <Field label="Borrower Address">
          <input
            type="text"
            value={borrower}
            onChange={(e) => setBorrower(e.target.value)}
            placeholder="0x…"
            required
            pattern="^0x[0-9a-fA-F]{40}$"
            title="Valid Ethereum address"
            className={inputCls}
          />
        </Field>

        <Field label="Duration (days)">
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="7"
            required
            min="1"
            className={inputCls}
          />
        </Field>

        {error   && <p className="text-red-400 text-xs">{error}</p>}
        {success && <p className="text-green-400 text-xs">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm transition-colors"
        >
          {loading ? "Processing…" : "Checkout"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none";
