const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");

module.exports = buildModule("MockToken", (m) => {
  const mockToken = m.contract("MockToken");
  return { mockToken };
});