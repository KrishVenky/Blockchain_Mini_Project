// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LabRegistry {
    address public admin;
    uint256 public lateFeePerDay = 0.01 ether;

    // ── Admin succession state ───────────────────────────────────────────────
    uint256 public lastAdminAction;
    uint256 public constant INACTIVITY_PERIOD = 30 days;
    uint256 public constant CHALLENGE_WINDOW  = 7 days;
    uint256 public constant SUCCESSION_STAKE  = 1 ether;

    address public pendingAdmin;
    uint256 public pendingStake;
    uint256 public successionInitiatedAt;

    struct Equipment {
        string name;
        bool isAvailable;
        address currentBorrower;
        uint256 dueDate;
        uint256 id;
    }

    mapping(uint256 => Equipment) public inventory;
    mapping(address => bool) public authorizedStaff;
    mapping(address => uint256) public penalties;

    event Borrowed(uint256 indexed equipmentId, address indexed borrower, uint256 dueDate);
    event Returned(uint256 indexed equipmentId, address indexed borrower, uint256 penaltyPaid);
    event PenaltyPaid(address indexed borrower, uint256 amount);
    event SuccessionInitiated(address indexed challenger, uint256 stake, uint256 deadline);
    event SuccessionConfirmed(address indexed newAdmin);
    event AdminProvedActive(address indexed admin, address stakeReturnedTo);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyStaff() {
        require(authorizedStaff[msg.sender] || msg.sender == admin, "Not authorized staff");
        _;
    }

    constructor() {
        admin = msg.sender;
        lastAdminAction = block.timestamp;
    }

    // ── Core lab functions ───────────────────────────────────────────────────

    function addStaff(address _staff) external onlyAdmin {
        lastAdminAction = block.timestamp;
        authorizedStaff[_staff] = true;
    }

    function addEquipment(uint256 _id, string memory _name) external onlyStaff {
        require(inventory[_id].id == 0, "Equipment ID already exists");
        inventory[_id] = Equipment(_name, true, address(0), 0, _id);
    }

    function checkout(uint256 _id, address _borrower, uint256 _durationDays) external onlyStaff {
        require(inventory[_id].isAvailable, "Equipment already out");
        require(penalties[_borrower] == 0, "Student has unpaid penalties");

        inventory[_id].isAvailable = false;
        inventory[_id].currentBorrower = _borrower;
        inventory[_id].dueDate = block.timestamp + (_durationDays * 1 days);

        emit Borrowed(_id, _borrower, inventory[_id].dueDate);
    }

    function returnEquipment(uint256 _id) external onlyStaff {
        Equipment storage item = inventory[_id];
        require(!item.isAvailable, "Item is already in lab");

        uint256 penalty = 0;
        if (block.timestamp > item.dueDate) {
            uint256 daysLate = (block.timestamp - item.dueDate) / 1 days;
            penalty = daysLate * lateFeePerDay;
            penalties[item.currentBorrower] += penalty;
        }

        address formerBorrower = item.currentBorrower;
        item.isAvailable = true;
        item.currentBorrower = address(0);
        item.dueDate = 0;

        emit Returned(_id, formerBorrower, penalty);
    }

    function payPenalty() external payable {
        uint256 owed = penalties[msg.sender];
        require(owed > 0, "No penalty owed");
        require(msg.value >= owed, "Insufficient payment");
        penalties[msg.sender] = 0;
        payable(admin).transfer(msg.value);
        emit PenaltyPaid(msg.sender, msg.value);
    }

    // ── Admin succession (Proof-of-Stake style) ──────────────────────────────
    //
    // If the admin loses their key or disappears, the system does not lock
    // forever. After INACTIVITY_PERIOD of no admin action, anyone can stake
    // SUCCESSION_STAKE ETH to initiate a handover. The original admin has
    // CHALLENGE_WINDOW days to prove they are still alive by calling proveActive().
    // If they do not respond, the challenger calls claimAdmin() and takes over.
    // Their stake is always returned — it exists only to prevent spam challenges.

    function initiateSuccession() external payable {
        require(
            block.timestamp > lastAdminAction + INACTIVITY_PERIOD,
            "Admin is still active"
        );
        require(msg.value >= SUCCESSION_STAKE, "Must stake 1 ETH to initiate");
        require(pendingAdmin == address(0), "Succession already in progress");

        pendingAdmin          = msg.sender;
        pendingStake          = msg.value;
        successionInitiatedAt = block.timestamp;

        emit SuccessionInitiated(
            msg.sender,
            msg.value,
            block.timestamp + CHALLENGE_WINDOW
        );
    }

    // Admin calls this to prove they are alive — cancels succession and
    // returns the challenger's stake since they acted in good faith.
    function proveActive() external onlyAdmin {
        require(pendingAdmin != address(0), "No succession in progress");

        lastAdminAction  = block.timestamp;
        address challenger = pendingAdmin;
        uint256 stake      = pendingStake;

        pendingAdmin          = address(0);
        pendingStake          = 0;
        successionInitiatedAt = 0;

        payable(challenger).transfer(stake);
        emit AdminProvedActive(msg.sender, challenger);
    }

    // Challenger calls this after CHALLENGE_WINDOW if admin never responded.
    // They become the new admin and their stake is returned.
    function claimAdmin() external {
        require(msg.sender == pendingAdmin, "Not the pending admin");
        require(
            block.timestamp > successionInitiatedAt + CHALLENGE_WINDOW,
            "Challenge window not over yet"
        );

        address newAdmin = pendingAdmin;
        uint256 stake    = pendingStake;

        admin                 = newAdmin;
        lastAdminAction       = block.timestamp;
        pendingAdmin          = address(0);
        pendingStake          = 0;
        successionInitiatedAt = 0;

        payable(newAdmin).transfer(stake);
        emit SuccessionConfirmed(newAdmin);
    }
}
