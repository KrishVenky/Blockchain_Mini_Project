import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;

describe("LabRegistry", function () {
  let registry;
  let admin, staff, nonStaff, borrower, borrower2;

  beforeEach(async function () {
    [admin, staff, nonStaff, borrower, borrower2] = await ethers.getSigners();

    const LabRegistry = await ethers.getContractFactory("LabRegistry");
    registry = await LabRegistry.deploy();
    await registry.waitForDeployment();

    // Admin adds staff
    await registry.addStaff(staff.address);

    // Staff seeds two equipment items
    await registry.connect(staff).addEquipment(1, "Oscilloscope");
    await registry.connect(staff).addEquipment(2, "Multimeter");
  });

  // ── Access Control ──────────────────────────────────────────────────────

  describe("Access Control", function () {
    it("non-staff cannot call checkout", async function () {
      await expect(
        registry.connect(nonStaff).checkout(1, borrower.address, 7)
      ).to.be.revertedWith("Not authorized staff");
    });

    it("non-staff cannot call returnEquipment", async function () {
      await registry.connect(staff).checkout(1, borrower.address, 7);
      await expect(
        registry.connect(nonStaff).returnEquipment(1)
      ).to.be.revertedWith("Not authorized staff");
    });

    it("non-admin cannot call addStaff", async function () {
      await expect(
        registry.connect(staff).addStaff(nonStaff.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("non-staff cannot add equipment", async function () {
      await expect(
        registry.connect(nonStaff).addEquipment(10, "Laser")
      ).to.be.revertedWith("Not authorized staff");
    });

    it("admin can call checkout and returnEquipment without being added as staff", async function () {
      await expect(registry.checkout(1, borrower.address, 7)).to.not.be.reverted;
      await expect(registry.returnEquipment(1)).to.not.be.reverted;
    });
  });

  // ── Checkout Rules ──────────────────────────────────────────────────────

  describe("Checkout", function () {
    it("cannot checkout equipment that is already out", async function () {
      await registry.connect(staff).checkout(1, borrower.address, 7);
      await expect(
        registry.connect(staff).checkout(1, borrower2.address, 7)
      ).to.be.revertedWith("Equipment already out");
    });

    it("cannot checkout if borrower has unpaid penalties", async function () {
      // Borrow item 1 and return it late to generate a penalty
      await registry.connect(staff).checkout(1, borrower.address, 1);
      await time.increase(3 * 24 * 60 * 60); // advance 3 days (2 late)
      await registry.connect(staff).returnEquipment(1);

      const penalty = await registry.penalties(borrower.address);
      expect(penalty).to.be.gt(0n, "Expected a non-zero penalty");

      // Same borrower cannot checkout another item
      await expect(
        registry.connect(staff).checkout(2, borrower.address, 7)
      ).to.be.revertedWith("Student has unpaid penalties");
    });

    it("successful checkout marks equipment unavailable and records borrower", async function () {
      await registry.connect(staff).checkout(1, borrower.address, 7);
      const item = await registry.inventory(1);
      expect(item.isAvailable).to.be.false;
      expect(item.currentBorrower).to.equal(borrower.address);
      expect(item.dueDate).to.be.gt(0n);
    });

    it("emits Borrowed event with correct args", async function () {
      const tx = await registry.connect(staff).checkout(1, borrower.address, 7);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedDue = BigInt(block.timestamp) + BigInt(7 * 24 * 60 * 60);

      await expect(tx)
        .to.emit(registry, "Borrowed")
        .withArgs(1n, borrower.address, expectedDue);
    });
  });

  // ── Return & Penalty Calculation ────────────────────────────────────────

  describe("Return", function () {
    it("penalty is 0 when returned on time", async function () {
      await registry.connect(staff).checkout(1, borrower.address, 7);
      await time.increase(3 * 24 * 60 * 60); // 3 days — still within 7-day window

      const tx = await registry.connect(staff).returnEquipment(1);
      await expect(tx)
        .to.emit(registry, "Returned")
        .withArgs(1n, borrower.address, 0n);

      expect(await registry.penalties(borrower.address)).to.equal(0n);
    });

    it("penalty is correctly calculated when returned late", async function () {
      await registry.connect(staff).checkout(1, borrower.address, 7);
      await time.increase(10 * 24 * 60 * 60); // 10 days total → 3 days late

      await registry.connect(staff).returnEquipment(1);

      const penalty = await registry.penalties(borrower.address);
      const lateFee = await registry.lateFeePerDay();
      expect(penalty).to.equal(3n * lateFee);
    });

    it("cannot return equipment that is already in the lab", async function () {
      await expect(
        registry.connect(staff).returnEquipment(1)
      ).to.be.revertedWith("Item is already in lab");
    });

    it("equipment is available again after return", async function () {
      await registry.connect(staff).checkout(1, borrower.address, 7);
      await registry.connect(staff).returnEquipment(1);

      const item = await registry.inventory(1);
      expect(item.isAvailable).to.be.true;
      expect(item.currentBorrower).to.equal(ethers.ZeroAddress);
      expect(item.dueDate).to.equal(0n);
    });
  });

  // ── Equipment ID Collision ──────────────────────────────────────────────

  describe("Equipment ID collision", function () {
    it("adding an existing ID reverts", async function () {
      await expect(
        registry.connect(staff).addEquipment(1, "Digital Scope")
      ).to.be.revertedWith("Equipment ID already exists");
    });

    it("cannot overwrite a currently borrowed item", async function () {
      await registry.connect(staff).checkout(1, borrower.address, 7);
      await expect(
        registry.connect(staff).addEquipment(1, "Oscilloscope v2")
      ).to.be.revertedWith("Equipment ID already exists");

      // Item is still borrowed, not reset
      const item = await registry.inventory(1);
      expect(item.isAvailable).to.be.false;
      expect(item.currentBorrower).to.equal(borrower.address);
    });

    it("adding a new unique ID works fine", async function () {
      await expect(
        registry.connect(staff).addEquipment(99, "New Device")
      ).to.not.be.reverted;
      const item = await registry.inventory(99);
      expect(item.name).to.equal("New Device");
    });
  });
});
