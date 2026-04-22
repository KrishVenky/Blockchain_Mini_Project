import { useState } from "react";
import { ethers } from "ethers";

export default function Return({ contract, role, equipment, onSuccess }) {
  const [equipmentId,   setEquipmentId]   = useState("");
  const [checkAddress,  setCheckAddress]  = useState("");
  const [penaltyResult, setPenaltyResult] = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [checkLoading,  setCheckLoading]  = useState(false);
  const [payLoading,    setPayLoading]    = useState(false);
  const [error,         setError]         = useState(null);
  const [success,       setSuccess]       = useState(null);
  const [paySuccess,    setPaySuccess]    = useState(null);

  const canAct = role === "ADMIN" || role === "STAFF";

  const selectedItem = equipment.find((e) => e.id === parseInt(equipmentId, 10));
  const now = Math.floor(Date.now() / 1000);
  const daysLate =
    selectedItem && !selectedItem.isAvailable && selectedItem.dueDate > 0 && now > selectedItem.dueDate
      ? Math.floor((now - selectedItem.dueDate) / 86400)
      : 0;

  // ── Return equipment ─────────────────────────────────────────────────────
  const handleReturn = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const tx      = await contract.returnEquipment(parseInt(equipmentId, 10));
      const receipt = await tx.wait();

      let penalty = 0n;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed.name === "Returned") penalty = parsed.args.penaltyPaid;
        } catch (_) { /* not our event */ }
      }

      const penaltyEth = ethers.formatEther(penalty);
      setSuccess(
        `Equipment #${equipmentId} returned.${
          penalty > 0n
            ? ` Penalty of ${penaltyEth} ETH locked to borrower.`
            : " No penalty."
        }`
      );
      setEquipmentId("");
      onSuccess();
    } catch (err) {
      setError(err.reason ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Check penalty balance ────────────────────────────────────────────────
  const checkPenalty = async () => {
    if (!checkAddress.trim()) return;
    setCheckLoading(true);
    setPenaltyResult(null);
    try {
      const raw = await contract.penalties(checkAddress.trim());
      setPenaltyResult({ address: checkAddress.trim(), eth: ethers.formatEther(raw), raw });
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckLoading(false);
    }
  };

  // ── Pay penalty (called by borrower from their own account) ─────────────
  const payPenalty = async () => {
    setPayLoading(true);
    setPaySuccess(null);
    setError(null);
    try {
      const owed = await contract.penalties(await contract.runner.getAddress());
      if (owed === 0n) {
        setError("No penalty on this account.");
        return;
      }
      const tx = await contract.payPenalty({ value: owed });
      await tx.wait();
      setPaySuccess(`Penalty of ${ethers.formatEther(owed)} ETH paid. Borrowing access restored.`);
      setPenaltyResult(null);
      onSuccess();
    } catch (err) {
      setError(err.reason ?? err.message);
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="max-w-sm space-y-10">

      {/* ── Return form ── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300 mb-6">
          Return Equipment
        </h2>

        {!canAct ? (
          <p className="text-gray-600 text-sm">Return requires STAFF or ADMIN role.</p>
        ) : (
          <form onSubmit={handleReturn} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1.5">
                Equipment ID
              </label>
              <input
                type="number"
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                placeholder="1"
                required
                min="1"
                className={inputCls}
              />
            </div>

            {selectedItem && !selectedItem.isAvailable && (
              <div className="bg-gray-900 border border-gray-800 rounded p-3 text-xs font-mono space-y-1">
                <p className="text-gray-400">
                  Borrower: {selectedItem.currentBorrower.slice(0, 10)}…{selectedItem.currentBorrower.slice(-4)}
                </p>
                <p className="text-gray-400">
                  Due: {new Date(selectedItem.dueDate * 1000).toLocaleDateString()}
                </p>
                {daysLate > 0 && (
                  <p className="text-red-400 font-semibold">
                    OVERDUE — {daysLate} day{daysLate !== 1 ? "s" : ""} late
                  </p>
                )}
              </div>
            )}

            {error   && <p className="text-red-400 text-xs">{error}</p>}
            {success && <p className="text-green-400 text-xs">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm transition-colors"
            >
              {loading ? "Processing…" : "Return Equipment"}
            </button>
          </form>
        )}
      </div>

      {/* ── Check penalty balance ── */}
      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
          Check Penalty Balance
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={checkAddress}
            onChange={(e) => setCheckAddress(e.target.value)}
            placeholder="0x… borrower address"
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={checkPenalty}
            disabled={checkLoading || !checkAddress.trim()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded text-sm border border-gray-700 transition-colors"
          >
            Check
          </button>
        </div>
        {penaltyResult !== null && (
          <p className={`mt-2 text-sm font-mono ${parseFloat(penaltyResult.eth) > 0 ? "text-red-400" : "text-green-400"}`}>
            Penalty: {penaltyResult.eth} ETH
          </p>
        )}
      </div>

      {/* ── Pay penalty ── */}
      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Pay My Penalty
        </h3>
        <p className="text-xs text-gray-600 mb-4">
          Switch MetaMask to the borrower account, then click below. ETH will be deducted from their wallet and borrowing access restored.
        </p>
        {paySuccess && <p className="text-green-400 text-xs mb-3">{paySuccess}</p>}
        <button
          onClick={payPenalty}
          disabled={payLoading}
          className="w-full py-2 bg-red-800 hover:bg-red-700 disabled:opacity-40 rounded text-sm transition-colors"
        >
          {payLoading ? "Processing…" : "Pay Penalty (current account)"}
        </button>
      </div>

    </div>
  );
}

const inputCls =
  "bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none";
