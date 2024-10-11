const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");

module.exports = buildModule("Felicity", (m) => {
  const usdcsAddress = "0x57c58d1869e9c354683C2477759402ba7Cb99043";
  const initialOwner = "0x0caDDE63e1A3F92d6E754eFb74288810DABFC150";
  const felicity = m.contract("Felicity", [usdcsAddress, initialOwner]);
  return { felicity };
});