const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SturanNetwork", function () {
  let sturanNetwork;
  let mockToken;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy(owner.address);
    await mockToken.waitForDeployment();

    const SturanNetwork = await ethers.getContractFactory("SturanNetwork");
    sturanNetwork = await SturanNetwork.deploy(mockToken.target, owner.address);
    await sturanNetwork.waitForDeployment();

    // Mint some tokens to addr1, addr2, and addr3 for testing
    await mockToken.mint(addr1.address, ethers.parseEther("1000"));
    await mockToken.mint(addr2.address, ethers.parseEther("1000"));
    await mockToken.mint(addr3.address, ethers.parseEther("1000"));

    // Approve SturanNetwork to spend tokens
    await mockToken
      .connect(addr1)
      .approve(sturanNetwork.target, ethers.parseEther("1000"));
    await mockToken
      .connect(addr2)
      .approve(sturanNetwork.target, ethers.parseEther("1000"));
    await mockToken
      .connect(addr3)
      .approve(sturanNetwork.target, ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await sturanNetwork.owner()).to.equal(owner.address);
    });
  });

  describe("Adding Campaign", function () {
    it("Should allow owner to add a campaign", async function () {
      const tx = await sturanNetwork.addCampaign(
        "Test Campaign",
        ethers.parseEther("100"),
        ethers.parseEther("10"),
        10,
        86400
      );
      await tx.wait();

      const campaignCount = await sturanNetwork.getCampaignCount();
      expect(campaignCount).to.equal(1n);

      const event = (await tx.wait()).logs.find(
        (log) => log.fragment && log.fragment.name === "CampaignCreated"
      );
      expect(event).to.exist;
      expect(event.args.campaignId).to.equal(0n);
      expect(event.args.name).to.equal("Test Campaign");
      expect(event.args.goal).to.equal(ethers.parseEther("100"));
      expect(event.args.duration).to.equal(86400n);
    });

    it("Should not allow non-owner to add a campaign", async function () {
      try {
        await sturanNetwork
          .connect(addr1)
          .addCampaign(
            "Test Campaign",
            ethers.parseEther("100"),
            ethers.parseEther("10"),
            10,
            86400
          );
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("OwnableUnauthorizedAccount");
      }
    });
  });

  describe("Contributing to campaign", function () {
    beforeEach(async function () {
      await sturanNetwork.addCampaign(
        "Test Campaign",
        ethers.parseEther("100"),
        ethers.parseEther("10"),
        10,
        86400
      );
    });

    it("Should allow contributing to an open campaign", async function () {
      const tx = await sturanNetwork
        .connect(addr1)
        .contribute(0, ethers.parseEther("5"));
      await tx.wait();

      const event = (await tx.wait()).logs.find(
        (log) => log.fragment && log.fragment.name === "ContributionMade"
      );
      expect(event).to.exist;
      expect(event.args.campaignId).to.equal(0n);
      expect(event.args.contributor).to.equal(addr1.address);
      expect(event.args.amount).to.equal(ethers.parseEther("5"));
    });

    it("Should not allow contribution exceeding max contribution", async function () {
      await expect(
        sturanNetwork.connect(addr1).contribute(0, ethers.parseEther("11"))
      ).to.be.revertedWith("Exceeds max contribution");
    });
  })
  
  describe("Close campaign", function () {
    beforeEach(async function () {
      await sturanNetwork.addCampaign(
        "Test Campaign",
        ethers.parseEther("100"),
        ethers.parseEther("10"),
        10,
        86400
      );
    });

    it("Should allow owner to close campaign", async function () {
      const tx = await sturanNetwork.closeCampaign(0);
      await tx.wait();

      const event = (await tx.wait()).logs.find(
        (log) => log.fragment && log.fragment.name === "CampaignClosed"
      );
      expect(event).to.exist;
      expect(event.args.campaignId).to.equal(0n);
      expect(event.args.name).to.equal("Test Campaign");
    });

    it("Should not allow non owner to close campaign", async function () {
        await expect(
          sturanNetwork.connect(addr1).closeCampaign(0)
        ).to.be.revertedWithCustomError(sturanNetwork, "OwnableUnauthorizedAccount");
    });
  });

  describe("Refunding", function () {
    beforeEach(async function () {
      await sturanNetwork.addCampaign(
        "Test Campaign",
        ethers.parseEther("100"),
        ethers.parseEther("10"),
        10,
        86400
      );
      await sturanNetwork.connect(addr1).contribute(0, ethers.parseEther("5"));
    });

    it("Should allow refund after campaign is closed", async function () {
      await sturanNetwork.closeCampaign(0);
      await ethers.provider.send("evm_increaseTime", [86400]); // Fast forward time
      await ethers.provider.send("evm_mine"); // Mine a new block

      const tx = await sturanNetwork.connect(addr1).refund(0);
      await tx.wait();

      const event = (await tx.wait()).logs.find(
        (log) => log.fragment && log.fragment.name === "ContributionRefunded"
      );
      expect(event).to.exist;
      expect(event.args.campaignId).to.equal(0n);
      expect(event.args.contributor).to.equal(addr1.address);
      expect(event.args.amount).to.equal(ethers.parseEther("5"));
    });

    it("Should not allow refund if campaign is still open", async function () {
        await expect(
          sturanNetwork.connect(addr1).refund(0)
        ).to.be.revertedWith("Campaign is still open");
    });
  });

  describe("WithdrawToken", function () {
    beforeEach(async function () {
      await sturanNetwork.addCampaign(
        "Test Campaign",
        ethers.parseEther("100"),
        ethers.parseEther("10"),
        10,
        86400
      );
      await sturanNetwork.connect(addr1).contribute(0, ethers.parseEther("10"));
      await sturanNetwork.connect(addr2).contribute(0, ethers.parseEther("10"));
      await sturanNetwork.closeCampaign(0);
      await sturanNetwork.addWhiteListedUser(addr2.address);
    });

    it("Should allow whitelisted user to withdraw tokens after campaign end and goal reached", async function () {
      await ethers.provider.send("evm_increaseTime", [86400]); // Fast forward time
      await ethers.provider.send("evm_mine"); // Mine a new block

      const initialBalance = await mockToken.balanceOf(addr3.address);
      await sturanNetwork
        .connect(addr2)
        .withdrawToken(0, addr3.address, ethers.parseEther("10"));
      const finalBalance = await mockToken.balanceOf(addr3.address);

      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("10"));
    });

    it("Should not allow non-whitelisted user to withdraw tokens", async function () {
        await expect(
          sturanNetwork.connect(addr1).withdrawToken(0, addr3.address, ethers.parseEther("10"))
        ).to.be.revertedWith("Not whitelisted");
      });
  });

  describe("Whitelist management", function () {
    it("Should allow owner to add user to whitelist", async function () {
      const tx = await sturanNetwork.addWhiteListedUser(addr1.address);
      await tx.wait();

      const event = (await tx.wait()).logs.find(
        (log) => log.fragment && log.fragment.name === "UserWithlisted"
      );
      expect(event).to.exist;
      expect(event.args.user).to.equal(addr1.address);
    });

    it("Should allow owner to remove user from whitelist", async function () {
      await sturanNetwork.addWhiteListedUser(addr1.address);

      const tx = await sturanNetwork.removeWithlistedUser(addr1.address);
      await tx.wait();

      const event = (await tx.wait()).logs.find(
        (log) => log.fragment && log.fragment.name === "RemoveFromWithlist"
      );
      expect(event).to.exist;
      expect(event.args.user).to.equal(addr1.address);
    });
  });

  describe("Get campaign details", function () {
    beforeEach(async function () {
      await sturanNetwork.addCampaign(
        "Test Campaign",
        ethers.parseEther("100"),
        ethers.parseEther("10"),
        10,
        86400
      );
      await sturanNetwork.connect(addr1).contribute(0, ethers.parseEther("5"));
    });

    it("Should return correct campaign details", async function () {
      const details = await sturanNetwork.getCampaignDetails(0);
      expect(details.name).to.equal("Test Campaign");
      expect(details.goal).to.equal(ethers.parseEther("100"));
      expect(details.maxContribution).to.equal(ethers.parseEther("10"));
      expect(details.maxContributor).to.equal(10n);
      expect(details.duration).to.equal(86400n);
      expect(details.isOpen).to.be.true;
      expect(details.contributors).to.deep.equal([addr1.address]);
      expect(details.contributions[0]).to.equal(ethers.parseEther("5"));
    });
  });

  describe("Get contributor status", function () {
    beforeEach(async function () {
      await sturanNetwork.addCampaign(
        "Test Campaign",
        ethers.parseEther("100"),
        ethers.parseEther("10"),
        10,
        86400
      );
      await sturanNetwork.connect(addr1).contribute(0, ethers.parseEther("5"));
    });

    it("Should return correct contributor status for contributor", async function () {
      const [isContributor, campaignId] =
        await sturanNetwork.getContributorStatus(addr1.address);
      expect(isContributor).to.be.true;
      expect(campaignId).to.equal(0n);
    });

    it("Should return correct contributor status for non-contributor", async function () {
      const [isContributor, campaignId] =
        await sturanNetwork.getContributorStatus(addr2.address);
      expect(isContributor).to.be.false;
      expect(campaignId).to.equal(0n);
    });
  });
});
