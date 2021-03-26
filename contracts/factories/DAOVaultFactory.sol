// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "../vaults/DAOVault.sol";

contract DAOVaultFactory is Ownable {
    DAOVault[] public daoVaults;
    address public daoVaultTemplate;

    constructor(address _daoVaultTemplate) {
        daoVaultTemplate = _daoVaultTemplate;
    }

    function createVault(bytes32 _vaultName, address _token, address _strategy) external onlyOwner {
        DAOVault daoVault = DAOVault(Clones.clone(daoVaultTemplate));
        daoVault.init(_vaultName, _token, _strategy, msg.sender);
        daoVaults.push(daoVault);
    }

    function changeDAOVaultTemplate(address _daoVaultTemplate)
        external
        onlyOwner
    {
        daoVaultTemplate = _daoVaultTemplate;
    }

    function getDAOVaults() external view returns (DAOVault[] memory) {
        return daoVaults;
    }
}
