// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "../strategies/DAOStrategy.sol";

contract DAOStrategyFactory is Ownable {
    DAOStrategy[] public daoStrategies;
    address public daoStrategyTemplate;

    constructor(address _daoStrategyTemplate) {
        daoStrategyTemplate = _daoStrategyTemplate;
    }

    function createStrategy(
        bytes32 _strategyName,
        address _token,
        address _cToken,
        address _compToken,
        address _comptroller,
        address _uniswapRouter,
        address _WETH
    ) external onlyOwner {
        DAOStrategy daoStrategy =
            DAOStrategy(Clones.clone(daoStrategyTemplate));
        daoStrategy.init(
            _strategyName,
            _token,
            _cToken,
            _compToken,
            _comptroller,
            _uniswapRouter,
            _WETH,
            msg.sender
        );
        daoStrategies.push(daoStrategy);
    }

    function changeDAOStrategyTemplate(address _daoStrategyTemplate)
        external
        onlyOwner
    {
        daoStrategyTemplate = _daoStrategyTemplate;
    }

    function getDAOStrategies() external view returns (DAOStrategy[] memory) {
        return daoStrategies;
    }
}
