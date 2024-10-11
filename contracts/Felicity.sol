// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IFelicity.sol";

contract Felicity is Ownable, IFelicity {
    using SafeERC20 for IERC20;

    IERC20 private token;
    Campaign[] public campaigns;

    event CampaignCreated(uint256 indexed campaignId, string name, uint256 goal, uint256 duration);
    event ContributionMade(uint256 indexed campaignId, address indexed contributor, uint256 amount);
    event CampaignClosed(uint256 indexed campaignId, string name, uint256 totalRaised);
    event ContributionRefunded(uint256 indexed campaignId, address indexed contributor, uint256 amount);

    constructor(address _tokenAddress, address initialOwner) Ownable(initialOwner) {
        token = IERC20(_tokenAddress);
        transferOwnership(msg.sender);
    }

    function addCampaign(
        string memory name,
        uint256 goal,
        uint256 maxContribution,
        uint256 maxContributor,
        uint256 duration
    ) external override onlyOwner {
        require(goal > 0, "Goal must be greater than zero");
        require(duration > 0, "Duration must be greater than zero");

        uint256 campaignId = campaigns.length;
        campaigns.push();
        Campaign storage newCampaign = campaigns[campaignId];

        newCampaign.campaignId = campaignId;
        newCampaign.name = name;
        newCampaign.goal = goal;
        newCampaign.maxContribution = maxContribution;
        newCampaign.maxContributor = maxContributor;
        newCampaign.duration = duration;
        newCampaign.startTime = block.timestamp;
        newCampaign.endTime = block.timestamp + duration;
        newCampaign.isOpen = true;

        emit CampaignCreated(campaignId, name, goal, duration);
    }

    function getCampaignCount() external view override returns (uint256) {
        return campaigns.length;
    }

    function getCampaignDetails(uint256 campaignId)
        external
        view
        override
        returns (
            string memory name,
            uint256 goal,
            uint256 maxContribution,
            uint256 maxContributor,
            uint256 duration,
            uint256 startTime,
            uint256 endTime,
            bool isOpen,
            address[] memory contributors,
            uint256[] memory contributions
        )
    {
        Campaign storage campaign = campaigns[campaignId];
        uint256[] memory contributionAmounts = new uint256[](
            campaign.contributors.length
        );

        for (uint i = 0; i < campaign.contributors.length; i++) {
            contributionAmounts[i] = campaign.contributions[campaign.contributors[i]];
        }

        return (
            campaign.name,
            campaign.goal,
            campaign.maxContribution,
            campaign.maxContributor,
            campaign.duration,
            campaign.startTime,
            campaign.endTime,
            campaign.isOpen,
            campaign.contributors,
            contributionAmounts
        );
    }

    function contribute(uint256 campaignId, uint256 amount) external override {
        Campaign storage campaign = campaigns[campaignId];

        require(campaign.isOpen, "Campaign is not available");
        require(block.timestamp < campaign.endTime, "Campaign has ended");
        require(campaign.contributions[msg.sender] + amount <= campaign.maxContribution, "Exceeds max contribution");
        require(campaign.contributors.length < campaign.maxContributor || campaign.contributions[msg.sender] > 0, "Max contributors reached");
    
        if (campaign.contributions[msg.sender] == 0) {
            campaign.contributors.push(msg.sender);
        }

        campaign.contributions[msg.sender] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit ContributionMade(campaignId, msg.sender, amount);
    }

    function closeCampaign(uint256 campaignId) external override onlyOwner {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.isOpen, "Campaign is already closed");
    
        campaign.isOpen = false;
        uint256 totalRaised = token.balanceOf(address(this));

        emit CampaignClosed(campaignId, campaign.name, totalRaised);
    }

    function refund(uint256 campaignId) external override {
        Campaign storage campaign = campaigns[campaignId];
        require(!campaign.isOpen, "Campaign is still open");
        require(block.timestamp >= campaign.endTime, "Campaign is not ended yet");

        uint256 amount = campaign.contributions[msg.sender];
        require(amount > 0, "No contribution to refund");

        campaign.contributions[msg.sender] = 0;
        token.safeTransfer(msg.sender, amount);

        emit ContributionRefunded(campaignId, msg.sender, amount);
    }

    function getContributors(uint256 campaignId) external view override returns (address[] memory) {
        return campaigns[campaignId].contributors;
    }
    
    function withdrawToken(address to, uint256 amount) external override onlyOwner {
        require(amount <= token.balanceOf(address(this)), "Insufficient balance");
        token.safeTransfer(to, amount);
    }

    function getContributorStatus(address account) external view override returns (bool, uint256) {
        for (uint i = 0; i < campaigns.length; i++) {
            if (campaigns[i].contributions[account] > 0) {
                return (true, i);
            }
        }
        return (false, 0);
    }
}