const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");

module.exports = buildModule("SturanNetwork", (m) => {
  const mockUSDC = "0x57c58d1869e9c354683C2477759402ba7Cb99043";
  const initialOwner = "0x0caDDE63e1A3F92d6E754eFb74288810DABFC150";
  const sturanNetwork = m.contract("SturanNetwork", [mockUSDC, initialOwner]);
  return { sturanNetwork };
});