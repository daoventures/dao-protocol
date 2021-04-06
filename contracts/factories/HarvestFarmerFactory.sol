// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "../strategies/HarvestFarmer.sol";

/// @title Contract to create Harvest-Farmer strategy
contract HarvestFarmerFactory is Ownable {
    HarvestFarmer[] public strategies;
    address public strategyTemplate;

    constructor(address _strategyTemplate) {
        strategyTemplate = _strategyTemplate;
    }

    /**
     * @notice Create new Harvest-Farmer strategy
     * @param _strategyName Name of strategy to create
     * @param _token Token that strategy accept and utilize
     * @param _hfVault Harvest Finance vault contract for _token
     * @param _hfStake Harvest Finance stake contract for _hfVault
     * @param _FARM FARM token contract
     * @param _uniswapRouter Uniswap Router contract that implement swap
     * @param _WETH WETH token contract
     */
    function createStrategy(
        bytes32 _strategyName,
        address _token,
        address _hfVault,
        address _hfStake,
        address _FARM,
        address _uniswapRouter,
        address _WETH
    ) external onlyOwner {
        HarvestFarmer strategy = HarvestFarmer(Clones.clone(strategyTemplate));
        strategy.init(
            _strategyName,
            _token,
            _hfVault,
            _hfStake,
            _FARM,
            _uniswapRouter,
            _WETH,
            msg.sender
        );
        strategies.push(strategy);
    }
}
