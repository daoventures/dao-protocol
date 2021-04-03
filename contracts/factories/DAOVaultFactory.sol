// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "../vaults/DAOVault.sol";

contract DAOVaultFactory is Ownable {
    DAOVault[] public vaults;
    address public vaultTemplate;

    constructor(address _vaultTemplate) {
        vaultTemplate = _vaultTemplate;
    }

    function createVault(
        bytes32 _vaultName,
        address _token,
        address _strategy
    ) external onlyOwner {
        DAOVault vault = DAOVault(Clones.clone(vaultTemplate));
        vault.init(_vaultName, _token, _strategy, msg.sender);
        vaults.push(vault);
    }
}
