# Lab Registry dApp — Demo & Presentation Guide

This is a full-stack decentralised application (dApp) that manages lab equipment borrowing on a blockchain. Everything you see in the browser is talking directly to a smart contract — there is no backend server, no database, no API. The blockchain is the backend.

---

## The Big Picture

Traditional borrowing systems store data in a central database a university owns and controls. Anyone with database access can edit records, delete history, or waive penalties quietly.

This system works differently:

```
Browser (React)
    ↕  ethers.js
MetaMask (wallet / transaction signer)
    ↕  JSON-RPC
Ganache (local Ethereum blockchain)
    ↕
LabRegistry.sol (smart contract — the actual logic + data)
```

Every checkout, return, and penalty lives permanently on the chain. No one — not even the admin — can silently alter a past record.

---

## Key Concepts to Know Before Presenting

**Smart Contract** — A program deployed to a blockchain. Once deployed, its code cannot be changed. It holds both logic (functions) and state (data). Think of it as a vending machine: you put in the right input, it executes the rules exactly as written and gives you the output. No human in the middle.

**Wallet / Account** — Every user has a public address (like a username) and a private key (like a password). MetaMask manages this. When you call a contract function that writes data, MetaMask signs the transaction with your private key to prove it came from you.

**Transaction** — Any action that changes blockchain state (checkout, return, add equipment) costs a small fee called gas and gets recorded permanently. Read-only calls (checking inventory, reading a penalty) are free.

**ABI (Application Binary Interface)** — The contract's public interface. It tells the frontend exactly what functions exist, what parameters they take, and what they return. The deploy script auto-generates this into `frontend/src/abi.js`.

**Events** — Smart contracts can emit events (like logs) when things happen. Our contract emits `Borrowed` and `Returned`. The History tab reads these events to reconstruct the full borrow history — no history array needed in the contract itself.

**Ganache** — A local fake Ethereum blockchain that runs on your machine. Comes with 10 pre-funded accounts with test ETH. Used for development so you are not spending real money.

---

## The Smart Contract — `contracts/LabRegistry.sol`

This is the heart of the system. Everything else is just a UI on top of it.

### Data it stores

```solidity
struct Equipment {
    string name;
    bool isAvailable;
    address currentBorrower;
    uint256 dueDate;
    uint256 id;
}

mapping(uint256 => Equipment) public inventory;       // equipment ID → item
mapping(address => bool) public authorizedStaff;      // who can checkout/return
mapping(address => uint256) public penalties;         // outstanding fines per borrower
```

Mappings are essentially hash tables stored on-chain. Anyone can read public mappings — the blockchain is transparent.

### Access control

Two modifiers guard every sensitive function:

```solidity
modifier onlyAdmin()  — only the address that deployed the contract
modifier onlyStaff()  — admin OR any address added via addStaff()
```

If someone who is not staff tries to call `checkout()`, the transaction reverts and nothing changes. The blockchain enforces this — there is no way around it.

### The checkout function

```solidity
function checkout(uint256 _id, address _borrower, uint256 _durationDays) external onlyStaff {
    require(inventory[_id].isAvailable, "Equipment already out");
    require(penalties[_borrower] == 0, "Student has unpaid penalties");

    inventory[_id].isAvailable = false;
    inventory[_id].currentBorrower = _borrower;
    inventory[_id].dueDate = block.timestamp + (_durationDays * 1 days);

    emit Borrowed(_id, _borrower, inventory[_id].dueDate);
}
```

Two hard rules enforced on-chain:
1. Cannot double-book equipment
2. Borrowers with unpaid penalties are blocked until cleared

`block.timestamp` is the current blockchain time. `dueDate` is stored as a Unix timestamp.

### The return + penalty calculation

```solidity
function returnEquipment(uint256 _id) external onlyStaff {
    uint256 penalty = 0;
    if (block.timestamp > item.dueDate) {
        uint256 daysLate = (block.timestamp - item.dueDate) / 1 days;
        penalty = daysLate * lateFeePerDay;
        penalties[item.currentBorrower] += penalty;
    }
    // reset the item back to available
}
```

The penalty is calculated entirely on-chain using the difference between the current block time and the stored due date. No one can manipulate this calculation — it runs exactly the same way for everyone.

---

## The Deployment Script — `scripts/deploy.js`

When you run `npx hardhat run scripts/deploy.js --network localhost`:

1. Compiles the Solidity contract to bytecode
2. Sends a deployment transaction to Ganache — the contract now lives at a specific address on the chain
3. Calls `addStaff()` to grant Account #1 staff permissions
4. Calls `addEquipment()` three times to seed the initial inventory
5. Reads the compiled ABI from Hardhat's artifacts folder and writes it into `frontend/src/abi.js` along with the contract address

After this, the frontend knows exactly where the contract lives and how to talk to it.

---

## The Frontend — `frontend/src/`

Built with React + Vite. No backend. Every data fetch goes directly to the blockchain via ethers.js.

### Connecting the wallet (`App.jsx`)

```js
const provider = new ethers.BrowserProvider(window.ethereum);  // MetaMask
const signer   = await provider.getSigner();                    // your account
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
```

`window.ethereum` is injected by MetaMask into the browser. The `signer` is what allows write transactions — it signs them with your private key.

### Role detection

```js
const adminAddr = await contract.admin();
if (account === adminAddr)                  → ADMIN
else if (await contract.authorizedStaff(account)) → STAFF
else                                        → VIEWER
```

This runs on connect. The badge in the top right updates instantly based on what the contract says about your address.

### Loading inventory

The contract has no `getAllEquipmentIds()` function, so the frontend probes IDs 1 through 100 and stops after 5 consecutive empty slots:

```js
for (let i = 1; i <= 100; i++) {
    const item = await contract.inventory(i);
    if (item.id === 0n) { emptyRun++; if (emptyRun >= 5) break; continue; }
    // item exists — add to list
}
```

`0n` is a BigInt zero — ethers.js v6 returns all uint256 values as JavaScript BigInts.

### Loading history from events

```js
const borrowEvents = await contract.queryFilter(contract.filters.Borrowed());
const returnEvents = await contract.queryFilter(contract.filters.Returned());
```

Events are indexed on the blockchain. We query all `Borrowed` and `Returned` events and correlate them by equipment ID + borrower address to build the history table. This is a common pattern when you want history without storing arrays on-chain (arrays are expensive in Solidity).

---

## The Tests — `test/LabRegistry.test.js`

15 tests, all passing. Run with `npx hardhat test`.

Key things being tested:

| Test | Why it matters |
|---|---|
| Non-staff cannot checkout | Access control works |
| Cannot checkout equipment already out | No double-booking |
| Blocked if borrower has unpaid penalties | Penalty enforcement works |
| Penalty is 0 when returned on time | Happy path correct |
| Penalty calculated correctly when late | Core business logic correct |
| Time manipulation with `evm_increaseTime` | Forces the blockchain clock forward to simulate overdue returns without waiting real days |

The time manipulation test is worth highlighting — you cannot wait 7 real days to test a late return, so Hardhat lets you fast-forward the blockchain clock:

```js
await time.increase(10 * 24 * 60 * 60);  // jump 10 days forward
await registry.returnEquipment(1);        // now it is 3 days overdue
```

---

## Demo Script (step by step)

### Setup (do before presenting)
- Ganache is open and running on port 7545
- MetaMask is connected to Ganache network, using Account #0
- Contract is deployed (`npx hardhat run scripts/deploy.js --network localhost`)
- Frontend is running (`cd frontend && npm run dev`)

### Live walkthrough

**1. Open http://localhost:5173**
- Point out: ADMIN badge — this is because our MetaMask address matches the address that deployed the contract. Role is read live from the chain.
- Stats bar shows 3 total, 3 available. This data came from reading the blockchain, not a database.

**2. Show the Inventory tab**
- Three items seeded by the deploy script. Status pills are green = available.
- Explain the ID probing approach since the contract has no getAllEquipmentIds().

**3. Checkout tab — check out item #1**
- Fill in Equipment ID: `1`, a Ganache borrower address, Duration: `7`
- Click Checkout → MetaMask pops up → Approve
- This sends a signed transaction to the contract's `checkout()` function on Ganache.
- Go back to Inventory → Refresh → Oscilloscope is now blue BORROWED with due date.

**4. History tab**
- Record appears — borrowed date, due date, status Active.
- Explain: this is read from the `Borrowed` event emitted by the contract, not stored in any database.

**5. Return tab — return item #1**
- Enter ID `1` → Return Equipment → Approve in MetaMask
- Success message: "No penalty" (returned within 7 days)
- History tab now shows the returned date and penalty column.

**6. Admin tab — add new equipment**
- Enter ID `4`, Name `"Laser Cutter"` → Add Equipment → Approve
- Go to Inventory → Refresh → 4 items, Total Equipment updates to 4.

**7. Show the tests (optional, strong finish)**
```powershell
npx hardhat test
```
All 15 green. Mention the time-manipulation test for late returns.

---

## Questions You Might Get Asked

**"Why blockchain and not just a normal database?"**
Immutability and trustlessness. A database admin can edit records. On-chain, past transactions cannot be altered — the penalty calculation and borrow history are permanently auditable.

**"What is gas?"**
A fee paid to the network for computation. On Ganache it is fake ETH so it costs nothing. On a real network you would pay a small amount per transaction.

**"What happens if Ganache restarts?"**
The chain resets — all state is lost. You redeploy. In production you would use a persistent testnet (Sepolia) or mainnet.

**"Why is the late fee so high (10 ETH per day)?"**
The contract initialises `lateFeePerDay = 10 ether`. On a local test chain this is just a unit — in a real system you would use a token or a much smaller denomination. It makes penalties easy to see in tests.

**"Can the admin cheat the penalty calculation?"**
No. The calculation runs inside the smart contract using `block.timestamp`. The admin cannot call a different function to skip it — `returnEquipment()` always runs the same code.
