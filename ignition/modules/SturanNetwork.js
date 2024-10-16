const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");

module.exports = buildModule("SturanNetwork", (m) => {
  const mockToken = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const initialOwner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; //localhost account
  const sturanNetwork = m.contract("SturanNetwork", [mockToken, initialOwner]);
  return { sturanNetwork };
});