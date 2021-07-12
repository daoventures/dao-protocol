// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

interface IEarnStrategy {
    function init(
        uint256 _pid, address _curveZap,
        address _admin, address _communityWallet, address _strategist, address _owner
    ) external;
}

/// @title Contract to create Earn strategy
contract EarnStrategyFactory is Ownable {
    address[] public strategies;

    /// @notice Create new Earn strategy
    /// @param _strategyTemplate Address of strategy template contract
    /// @param _pid Index of pool in Convex
    /// @param _curveZap Address of CurveZap contract
    /// @param _admin Address of admin
    /// @param _communityWallet Address of community wallet
    /// @param _strategist Address of strategist
    function createStrategy(
        address _strategyTemplate,
        uint256 _pid, address _curveZap,
        address _admin, address _communityWallet, address _strategist
    ) external onlyOwner returns (address) {
        IEarnStrategy strategy = IEarnStrategy(Clones.clone(_strategyTemplate));
        strategy.init(
            _pid, _curveZap,
            _admin, _communityWallet, _strategist,
            msg.sender
        );
        strategies.push(address(strategy));

        return address(strategy);
    }

    /// @notice Function to get sum of deployed strategies
    /// @return Sum of deployed strategies
    function getTotalStrategies() external view returns (uint256) {
        return strategies.length;
    }
}
