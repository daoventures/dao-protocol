// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IDaoVault {
    function deposit(uint _amounts, uint256 _tokenIndex) external;
    function withdraw(uint _amounts, uint256 _tokenIndex) external;
}

interface IERC20 {
    function approve(address spender, uint amount) external;
    function balanceOf(address account) external view returns (uint);
    function transfer(address recipient, uint amount) external returns (bool);
}

/**
 * @notice This is a sample contract to test deposit token to CompoundFarmer contract
 * By default the deposit transaction will be reverted
 */
contract SampleContract {
    IDaoVault daoVault;
    IERC20 token;

    constructor(address _daoVaultAddress, address _tokenAddress) {
        daoVault = IDaoVault(_daoVaultAddress);
        token = IERC20(_tokenAddress);
    }

    function approve(address _address, uint _amount) external {
        token.approve(_address, _amount);
    }

    function deposit(uint _amount, uint _tokenIndex) external {
        daoVault.deposit(_amount, _tokenIndex);
    }

    function withdraw(uint _amount, uint256 _tokenIndex) external {
        daoVault.withdraw(_amount, _tokenIndex);
    }

    function transfer(address _recipient) external {
        token.transfer(_recipient, token.balanceOf(address(this)));
    }
}
