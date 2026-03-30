# Lab Registry dApp

Blockchain-based lab equipment borrowing system built with Hardhat + ethers.js v6 + React + Vite + Tailwind CSS.

## Dev workflow

```bash
# 1 — Install Hardhat dependencies (project root)
npm install

# 2 — Terminal A: run local Hardhat node
npx hardhat node

# 3 — Terminal B: compile & deploy (seeds 3 items + 1 staff account)
npx hardhat run scripts/deploy.js --network localhost
#   → prints contract address
#   → writes frontend/src/abi.js automatically

# 4 — Terminal C: start the frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and connect MetaMask to **Hardhat Localhost** (chain ID 31337, RPC http://127.0.0.1:8545).

Import test accounts using the Hardhat mnemonic printed when `npx hardhat node` starts:

| Account | Role  |
|---------|-------|
| #0      | Admin |
| #1      | Staff |
| #2+     | Viewer (borrowers) |

## Tests

```bash
npx hardhat test
```

Covers: access control, double-checkout, penalty-blocked checkout, on-time return (no penalty), late return (correct penalty via `evm_increaseTime`), ID collision behaviour.

## Contract notes

`contracts/LabRegistry.sol` is the canonical source — do not edit it.

- `lateFeePerDay` is initialised to `10 ether` (10 × 10¹⁸ wei). Displayed as ETH in the UI.
- The contract has no `getAllEquipmentIds()`. The frontend probes IDs 1–100 and stops after 5 consecutive empty slots.
- History is reconstructed from `Borrowed` / `Returned` events — no on-chain history arrays needed.
- There is no `clearPenalty` or `removeStaff` in this contract version. Extend the contract if needed.
