// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LabRegistry {
    address public admin;
    uint256 public lateFeePerDay = 10 ether; // Example unit (could be tokens or points)

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
    }

    function addStaff(address _staff) external onlyAdmin {
        authorizedStaff[_staff] = true;
    }

    function addEquipment(uint256 _id, string memory _name) external onlyStaff {
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
}
