pragma solidity 0.7.6;

import "@openzeppelin/contracts/proxy/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract uniVaultFactory is Ownable {
    UpgradeableBeacon immutable upgradeableBeacon;

    address[] public vaults;

    constructor(address _logic) {
        upgradeableBeacon = new UpgradeableBeacon(_logic);
    }

    function updateLogic(address _newImpl) onlyOwner public{
        upgradeableBeacon.upgradeTo(_newImpl);
    }

    function createVault(bytes calldata _data) external onlyOwner returns (address _proxyAddress){
        
        BeaconProxy proxy = new BeaconProxy(
           address(upgradeableBeacon),
            _data
        );

        _proxyAddress = address(proxy);
        

        vaults.push(address(proxy));
    }

    function getVault(uint _index) external view returns (address) {
        return vaults[_index];
    }

    function totalVaults() external view returns (uint) {
        return vaults.length;
    }

}

