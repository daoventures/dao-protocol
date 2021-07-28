// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEarnVault is IERC20 {
    function deposit(uint, bool) external;
    function withdraw(uint) external;
}

interface ICurveZap {
    function deposit(address, uint, address, bool) external;
    function depositZap(address, uint, address, bool) external;
    function withdraw(address, uint, address) external;
}

contract Sample {
    IERC20 lpToken;
    IEarnVault vault;
    ICurveZap curveZap;
    IERC20 USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 AXS = IERC20(0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b);
    constructor (address _lpToken, address _vault, address _curveZap) {
        lpToken = IERC20(_lpToken);
        lpToken.approve(_vault, type(uint).max);
        vault = IEarnVault(_vault);
        curveZap = ICurveZap(_curveZap);
    }
    function deposit() external {
        vault.deposit(lpToken.balanceOf(address(this)), false);
    }
    function withdraw() external {
        vault.withdraw(vault.balanceOf(address(this)));
    }

    function depositZap1() external {
        curveZap.deposit(address(vault), 1e6, address(USDT), false);
    }

    function depositZap2() external {
        curveZap.depositZap(address(vault), 1e18, address(AXS), false);
    }

    function withdrawZap() external {
        curveZap.withdraw(address(vault), 1e18, address(USDT));
    }
}