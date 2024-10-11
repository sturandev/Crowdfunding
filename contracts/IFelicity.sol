// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFelicity {
    struct Campaign {
        uint256 campaignId;
        string name;
        uint256 goal;
        uint256 maxContribution;
        uint256 maxContributor;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        bool isOpen;
        address[] contributors;
        mapping(address => uint256) contributions;
    }

    function addCampaign(
        string memory name,
        uint256 goal,
        uint256 maxContribution,
        uint256 maxContributor,
        uint256 duration
    ) external;

    function getCampaignCount() external view returns (uint256);

    function getCampaignDetails(
        uint256 campaignId
    )
        external
        view
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
        );

    function contribute(uint256 campaignId, uint256 amount) external;

    function closeCampaign(uint256 campaignId) external;

    function refund(uint256 campaignId) external;

    function getContributors(uint256 campaignId) external view returns (address[] memory);

    function withdrawToken(address to, uint256 amount) external;

    function getContributorStatus(address account) external view returns (bool, uint256);
}
