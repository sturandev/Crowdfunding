const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Felicity", function () {
  let MockToken, mockToken;
  let Felicity, felicity;
  let owner, addr1, addr2, addr3;
  let initialSupply;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Log balances
    for (const signer of [owner, addr1, addr2, addr3]) {
      const balance = await ethers.provider.getBalance(signer.address);
      console.log(`${signer.address} balance: ${ethers.formatEther(balance)} ETH`);
    }
  
    initialSupply = ethers.parseEther("1000000");

    MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("MockToken", "MTK", initialSupply);
    await mockToken.waitForDeployment();

    Felicity = await ethers.getContractFactory("Felicity");
    felicity = await Felicity.deploy(await mockToken.getAddress(), owner.address);
    await felicity.waitForDeployment();

    const transferAmount = ethers.parseEther("1000");
    await mockToken.transfer(addr1.address, transferAmount);
    await mockToken.transfer(addr2.address, transferAmount);
  
    await mockToken.connect(addr1).approve(await felicity.getAddress(), transferAmount);
    await mockToken.connect(addr2).approve(await felicity.getAddress(), transferAmount);
  });

  describe("Deployment", function(){
    it("Should set the right owner", async function () {
      expect(await felicity.owner()).to.equal(owner.address);
    });

    it("Should set the correct token address", async function(){
      expect(await felicity.token()).to.equal(await mockToken.getAddress());
    });
  });
});