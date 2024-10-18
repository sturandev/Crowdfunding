const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting", () => {
  let voting;
  let mockToken;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy(owner.address);
    await mockToken.waitForDeployment();

    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy(mockToken.target, owner.address);
    await voting.waitForDeployment();

    await mockToken.mint(addr1.address, ethers.parseEther("1000"));
    await mockToken.mint(addr2.address, ethers.parseEther("1000"));

    await mockToken
      .connect(addr1)
      .approve(voting.target, ethers.parseEther("1000"));
    await mockToken
      .connect(addr2)
      .approve(voting.target, ethers.parseEther("1000"));
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await voting.owner()).to.equal(owner.address);
    });
  });

  describe("Submit proposal", () => {
    it("Should add the proposals", async () => {
      const tx = await voting
        .connect(addr1)
        .submitProposal(
          "Proposal 1",
          "Lorem ipsum",
          86400,
          ethers.parseEther("100")
        );

      const block = await ethers.provider.getBlock("latest");
      const expectedEndTime = block.timestamp + 86400;

      await expect(tx)
        .to.emit(voting, "ProposalSubmitted")
        .withArgs(
          0,
          "Proposal 1",
          addr1.address,
          "Lorem ipsum",
          expectedEndTime
        );

      const proposal = await voting.proposals(0);
      expect(proposal.proposer).to.equal(addr1.address);
      expect(proposal.proposalDeposit).to.equal(ethers.parseEther("100"));
    });

    it("Should transfer deposit from proposer", async () => {
      const initialBalance = await mockToken.balanceOf(addr1.address);

      await voting
        .connect(addr1)
        .submitProposal(
          "Proposal 2",
          "Description of proposal 2",
          86400,
          ethers.parseEther("100")
        );

      const finalBalance = await mockToken.balanceOf(addr1.address);
      const difference = initialBalance - finalBalance;
      expect(difference).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Voting", () => {
    beforeEach(async () => {
      // Remove the proposal submission from this beforeEach since we're testing it in the test case
    });

    it("Should allow user to vote and lock token", async () => {
      // First submit a proposal
      const tx = await voting
        .connect(addr1)
        .submitProposal(
          "Proposal 1",
          "Description",
          86400,
          ethers.parseEther("100")
        );

      const block = await ethers.provider.getBlock("latest");
      const expectedEndTime = block.timestamp + 86400;

      await expect(tx)
        .to.emit(voting, "ProposalSubmitted")
        .withArgs(
          0,
          "Proposal 1",
          addr1.address,
          "Description",
          expectedEndTime
        );

      // Then test voting
      const initialBalance = await mockToken.balanceOf(addr2.address);
      await voting.connect(addr2).vote(0, true, ethers.parseEther("50"));
      const finalBalance = await mockToken.balanceOf(addr2.address);

      const difference = initialBalance - finalBalance;
      expect(difference).to.equal(ethers.parseEther("50"));

      const proposal = await voting.proposals(0);
      expect(proposal.yesVotes).to.equal(1n);
      expect(proposal.totalVoters).to.equal(1n);
    });

    it("Should prevent double voting from the same address", async () => {
      await voting
        .connect(addr1)
        .submitProposal(
          "Proposal 1",
          "Description",
          86400,
          ethers.parseEther("100")
        );

      await voting.connect(addr2).vote(0, true, ethers.parseEther("50"));
      await expect(
        voting.connect(addr2).vote(0, true, ethers.parseEther("50"))
      ).to.be.revertedWith("Already voted");
    });
  });

  describe("Finalize Proposal", () => {
    beforeEach(async () => {
        // Mint tokens for testing
        await mockToken.mint(addr1.address, ethers.parseEther("1000"));
        await mockToken.mint(addr2.address, ethers.parseEther("1000"));
        await mockToken.mint(addr3.address, ethers.parseEther("1000"));

        // Approve tokens for proposal submission and voting
        await mockToken.connect(addr1).approve(voting.target, ethers.parseEther("150")); // 100 for deposit + 50 for voting
        await mockToken.connect(addr2).approve(voting.target, ethers.parseEther("50"));
        await mockToken.connect(addr3).approve(voting.target, ethers.parseEther("50"));
        
        // Submit initial proposal
        await voting.connect(addr1).submitProposal(
            "Proposal 1",
            "Description",
            86400,
            ethers.parseEther("100")
        );
    });

    it('Should finalize proposal as approved when majority vote yes', async () => {
        // Cast votes
        await voting.connect(addr1).vote(0, true, ethers.parseEther("50"));
        await voting.connect(addr2).vote(0, true, ethers.parseEther("50"));
        await voting.connect(addr3).vote(0, false, ethers.parseEther("50"));
        console.log(addr1, addr2, addr3);

        // Increase time to end voting period
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);

        // Finalize proposal
        const tx = await voting.connect(owner).finalizeProposal(0);

        // Get proposal after finalization
        const proposal = await voting.proposals(0);

        // Verify proposal state
        expect(proposal.isExecuted).to.be.true;
        expect(proposal.approvedByLabs).to.be.true;

        // Verify event emission
        await expect(tx)
            .to.emit(voting, "ProposalFinalized")
            .withArgs(0, true);
    });

    it("Should return deposit and unlock token", async () => {
        // Cast initial vote
        await voting.connect(addr2).vote(0, true, ethers.parseEther("50"));

        // Get initial balances
        const proposerInitialBalance = await mockToken.balanceOf(addr1.address);
        const voterInitialBalance = await mockToken.balanceOf(addr2.address);

        // Increase time and finalize proposal
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);

        // Finalize the proposal
        await voting.connect(addr2).finalizeProposal(0);

        // Get final balances
        const proposerFinalBalance = await mockToken.balanceOf(addr1.address);
        const voterFinalBalance = await mockToken.balanceOf(addr2.address);

        // Verify deposit return (100 tokens)
        expect(proposerFinalBalance).to.equal(
            proposerInitialBalance + ethers.parseEther("100")
        );

        // Verify voting tokens return (50 tokens)
        expect(voterFinalBalance).to.equal(
            voterInitialBalance + ethers.parseEther("50")
        );

        // Verify proposal state
        const proposal = await voting.proposals(0);
        expect(proposal.depositReturned).to.be.true;
    });
});
});
