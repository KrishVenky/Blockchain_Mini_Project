import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ABI, CONTRACT_ADDRESS } from "./abi.js";
import Header from "./components/Header.jsx";
import StatsBar from "./components/StatsBar.jsx";
import Inventory from "./components/Inventory.jsx";
import Checkout from "./components/Checkout.jsx";
import Return from "./components/Return.jsx";
import History from "./components/History.jsx";
import Admin from "./components/Admin.jsx";

const TABS = ["inventory", "checkout", "return", "history", "admin"];

export default function App() {
  const [signer, setSigner]       = useState(null);
  const [contract, setContract]   = useState(null);
  const [account, setAccount]     = useState(null);
  const [role, setRole]           = useState("VIEWER");
  const [equipment, setEquipment] = useState([]);
  const [history, setHistory]     = useState([]);
  const [activeTab, setActiveTab] = useState("inventory");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // ── Wallet connection ────────────────────────────────────────────────────
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("MetaMask not detected. Install it from metamask.io.");
      return;
    }
    try {
      setError(null);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const _signer  = await provider.getSigner();
      const _account = await _signer.getAddress();
      const _contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, _signer);

      setSigner(_signer);
      setAccount(_account);
      setContract(_contract);

      // Role detection
      const adminAddr = await _contract.admin();
      if (_account.toLowerCase() === adminAddr.toLowerCase()) {
        setRole("ADMIN");
      } else {
        const isStaff = await _contract.authorizedStaff(_account);
        setRole(isStaff ? "STAFF" : "VIEWER");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Re-detect role when account changes in MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = () => connectWallet();
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum.removeListener("accountsChanged", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Equipment loader ─────────────────────────────────────────────────────
  // The contract has no getAllEquipmentIds(). We probe IDs 1–100 and stop
  // after 5 consecutive empty slots (id === 0n means the slot was never set).
  const loadEquipment = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const items = [];
      let emptyRun = 0;
      const now = Math.floor(Date.now() / 1000);

      for (let i = 1; i <= 100; i++) {
        const item = await contract.inventory(i);
        if (item.id === 0n) {
          emptyRun++;
          if (emptyRun >= 5) break;
          continue;
        }
        emptyRun = 0;
        const dueDate   = Number(item.dueDate);
        const isOverdue = !item.isAvailable && dueDate > 0 && now > dueDate;
        items.push({
          id:              Number(item.id),
          name:            item.name,
          isAvailable:     item.isAvailable,
          currentBorrower: item.currentBorrower,
          dueDate,
          isOverdue,
        });
      }
      setEquipment(items);
    } catch (err) {
      setError("Failed to load equipment: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [contract]);

  // ── History loader ───────────────────────────────────────────────────────
  // Reconstruct borrow history by correlating Borrowed + Returned events.
  const loadHistory = useCallback(async () => {
    if (!contract) return;
    try {
      const [borrowEvents, returnEvents] = await Promise.all([
        contract.queryFilter(contract.filters.Borrowed()),
        contract.queryFilter(contract.filters.Returned()),
      ]);

      // Build a lookup: equipmentId → latest Returned event for that borrower
      const returnMap = {};
      for (const evt of returnEvents) {
        const key = `${evt.args.equipmentId}-${evt.args.borrower.toLowerCase()}`;
        returnMap[key] = evt;
      }

      const records = await Promise.all(
        borrowEvents.map(async (evt) => {
          const key    = `${evt.args.equipmentId}-${evt.args.borrower.toLowerCase()}`;
          const retEvt = returnMap[key];
          const block  = await evt.getBlock();
          let returnedAt = null;
          let penalty    = null;
          if (retEvt) {
            const retBlock = await retEvt.getBlock();
            returnedAt = retBlock.timestamp;
            penalty    = retEvt.args.penaltyPaid;
          }
          return {
            equipmentId: Number(evt.args.equipmentId),
            borrower:    evt.args.borrower,
            borrowedAt:  block.timestamp,
            dueDate:     Number(evt.args.dueDate),
            returnedAt,
            penalty,
            txHash:      evt.transactionHash,
          };
        })
      );

      setHistory([...records].reverse());
    } catch (err) {
      console.error("History load failed:", err);
    }
  }, [contract]);

  useEffect(() => {
    if (contract) {
      loadEquipment();
      loadHistory();
    }
  }, [contract, loadEquipment, loadHistory]);

  const refresh = () => {
    loadEquipment();
    loadHistory();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const visibleTabs = TABS.filter((t) => {
    if (t === "checkout" || t === "return" || t === "admin")
      return role === "ADMIN" || role === "STAFF";
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      <Header account={account} role={role} onConnect={connectWallet} />

      {!account ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <p className="text-gray-500 text-sm">
              Connect your wallet to access the Lab Registry
            </p>
            <button
              onClick={connectWallet}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"
            >
              Connect MetaMask
            </button>
          </div>
        </div>
      ) : (
        <>
          <StatsBar equipment={equipment} />

          {error && (
            <div className="mx-6 mt-3 p-3 bg-red-950 border border-red-800 rounded text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Tab bar */}
          <div className="px-6 border-b border-gray-800 flex gap-0 mt-4">
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-xs uppercase tracking-widest border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <main className="p-6">
            {activeTab === "inventory" && (
              <Inventory equipment={equipment} loading={loading} onRefresh={refresh} />
            )}
            {activeTab === "checkout" && (
              <Checkout contract={contract} role={role} onSuccess={refresh} />
            )}
            {activeTab === "return" && (
              <Return contract={contract} role={role} equipment={equipment} onSuccess={refresh} />
            )}
            {activeTab === "history" && (
              <History history={history} equipment={equipment} onRefresh={refresh} />
            )}
            {activeTab === "admin" && (
              <Admin contract={contract} role={role} onSuccess={refresh} />
            )}
          </main>
        </>
      )}
    </div>
  );
}
