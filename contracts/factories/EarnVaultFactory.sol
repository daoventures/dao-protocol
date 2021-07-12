// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

interface IEarnVault {
    function init(
        address _lpToken,address _strategy, address _curveZap,
        address _treasuryWallet, address _communityWallet,
        address _admin, address _strategist, address _biconomy, address _owner
    ) external;
}

contract EarnVaultFactory is Ownable {
    address[] public vaults;

    /// @notice Create a new Earn vault
    /// @param _vaultTemplate Address of vault template contract
    /// @param _lpToken Address of Curve pool LP token
    /// @param _strategy Address of Earn strategy contract
    /// @param _curveZap Address of CurveZap contract
    /// @param _treasuryWallet Address of treasury wallet
    /// @param _communityWallet Address of community wallet
    /// @param _admin Address of admin
    /// @param _strategist Address of strategist
    /// @param _biconomy Address of Biconomy contract
    function createVault(
        address _vaultTemplate,
        address _lpToken, address _strategy, address _curveZap,
        address _treasuryWallet, address _communityWallet,
        address _admin, address _strategist, address _biconomy
    ) external onlyOwner returns (address) {
        IEarnVault vault = IEarnVault(Clones.clone(_vaultTemplate));
        vault.init(
            _lpToken, _strategy, _curveZap,
            _treasuryWallet, _communityWallet,
            _admin, _strategist, _biconomy, msg.sender
        );
        vaults.push(address(vault));

        return address(vault);
    }

    /// @notice Function to get sum of deployed vaults
    /// @return Sum of deployed vaults
    function getTotalVaults() external view returns (uint256) {
        return vaults.length;
    }
}
