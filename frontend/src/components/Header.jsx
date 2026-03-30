const ROLE_STYLES = {
  ADMIN:  "bg-purple-950 text-purple-300 border-purple-700",
  STAFF:  "bg-blue-950  text-blue-300  border-blue-700",
  VIEWER: "bg-gray-800  text-gray-400  border-gray-600",
};

export default function Header({ account, role, onConnect }) {
  return (
    <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold tracking-[0.2em] text-white">
          LAB REGISTRY
        </h1>
        <p className="text-xs text-gray-600 mt-0.5 tracking-wider">
          BLOCKCHAIN EQUIPMENT BORROWING SYSTEM
        </p>
      </div>

      <div className="flex items-center gap-3">
        {account ? (
          <>
            <span
              className={`px-2.5 py-1 text-xs border rounded font-mono tracking-widest ${ROLE_STYLES[role]}`}
            >
              {role}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {account.slice(0, 6)}…{account.slice(-4)}
            </span>
          </>
        ) : (
          <button
            onClick={onConnect}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors tracking-wide"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
