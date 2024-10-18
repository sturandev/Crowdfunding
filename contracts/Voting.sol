// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Voting is Ownable {
    IERC20 public token;

    struct Proposal {
        string proposalsName;
        address proposer;
        string description;
        uint256 endTime;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 totalVoters;
        bool isExecuted;
        bool approvedByLabs;
        bool depositReturned;
        uint256 proposalDeposit;
        mapping(address => bool) voters;
        mapping(address => uint256) lockedTokens;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    event ProposalSubmitted(uint256 proposalId, string proposalsName, address proposer, string description, uint256 endTime);
    event Voted(uint256 proposalId, address voter, bool support, uint256 amount);
    event ProposalFinalized(uint256 proposalId, bool approved);
    event TokensUnlocked(address voter, uint256 amount);
    event DepositReturned(address proposer, uint256 amount);

    constructor(IERC20 _token, address initialOwner) Ownable(initialOwner) {
        token = _token;
    }

    modifier proposalExists(uint256 proposalId) {
        require(proposalId < proposalCount, "Proposal does not exist");
        _;
    }

    function submitProposal(
        string memory proposalsName,
        string memory description,
        uint256 votingDuration,
        uint256 proposalDeposit
    ) external {
        require(token.balanceOf(msg.sender) >= proposalDeposit, "Not enough tokens to submit proposal");

        // Transfer tokens as deposit
        token.transferFrom(msg.sender, address(this), proposalDeposit);

        Proposal storage newProposal = proposals[proposalCount++];
        newProposal.proposalsName = proposalsName;
        newProposal.proposer = msg.sender;
        newProposal.description = description;
        newProposal.endTime = block.timestamp + votingDuration;
        newProposal.proposalDeposit = proposalDeposit;

        emit ProposalSubmitted(proposalCount - 1, proposalsName, msg.sender, description, newProposal.endTime);
    }

    function vote(uint256 proposalId, bool support, uint256 amount) external proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp < proposal.endTime, "Voting period has ended");
        require(!proposal.voters[msg.sender], "Already voted");
        require(token.balanceOf(msg.sender) >= amount, "Not enough tokens to vote");

        // Lock tokens
        proposal.lockedTokens[msg.sender] = amount;
        token.transferFrom(msg.sender, address(this), amount);
        proposal.voters[msg.sender] = true;

        proposal.totalVoters += 1;

        if (support) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit Voted(proposalId, msg.sender, support, amount);
    }

    function finalizeProposal(uint256 proposalId) external proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.endTime, "Voting period not ended");
        require(!proposal.isExecuted, "Proposal already finalized");

        proposal.isExecuted = true;

        uint256 totalVotes = proposal.yesVotes + proposal.noVotes;
        if (totalVotes > 0 && proposal.yesVotes * 100 / totalVotes >= 51) {
            proposal.approvedByLabs = true;
            emit ProposalFinalized(proposalId, true);
        } else {
            emit ProposalFinalized(proposalId, false);
        }

        // Return the proposal deposit to the proposer
        _returnDeposit(proposalId);

        // Unlock tokens for voters
        _unlockTokensForVoter(proposalId, msg.sender);
    }

    function _unlockTokensForVoter(uint256 proposalId, address voter) internal {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.voters[voter]) {
            uint256 lockedAmount = proposal.lockedTokens[voter];
            if (lockedAmount > 0) {
                proposal.lockedTokens[voter] = 0;
                token.transfer(voter, lockedAmount);
                emit TokensUnlocked(voter, lockedAmount);
            }
        }
    }

    function _returnDeposit(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.depositReturned, "Deposit already returned");

        token.transfer(proposal.proposer, proposal.proposalDeposit);
        proposal.depositReturned = true;

        emit DepositReturned(proposal.proposer, proposal.proposalDeposit);
    }
}