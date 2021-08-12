// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "hardhat/console.sol";

interface IRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}

interface IMasterChef {
    function deposit(uint pid, uint amount) external;
    function withdraw(uint pid, uint amount) external;
}

interface IIlluvium {
    function stake(uint amount, uint64 lockUntil, bool useSILV) external;
    function unstake(uint depositId, uint amount, bool useSILV) external;
}

interface IWETH is IERC20Upgradeable {
    function withdraw(uint256 _amount) external;
}

contract MVFStrategy is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IWETH;

    IERC20Upgradeable constant USDT = IERC20Upgradeable(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20Upgradeable constant USDC = IERC20Upgradeable(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20Upgradeable constant DAI = IERC20Upgradeable(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IWETH constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    IERC20Upgradeable constant AXS = IERC20Upgradeable(0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b);
    IERC20Upgradeable constant SLP = IERC20Upgradeable(0xCC8Fa225D80b9c7D42F96e9570156c65D6cAAa25);
    IERC20Upgradeable constant ILV = IERC20Upgradeable(0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E);
    IERC20Upgradeable constant GHST = IERC20Upgradeable(0x3F382DbD960E3a9bbCeaE22651E88158d2791550);
    IERC20Upgradeable constant REVV = IERC20Upgradeable(0x557B933a7C2c45672B610F8954A3deB39a51A8Ca);
    IERC20Upgradeable constant MVI = IERC20Upgradeable(0x72e364F2ABdC788b7E918bc238B21f109Cd634D7);

    IERC20Upgradeable constant AXSETH = IERC20Upgradeable(0x0C365789DbBb94A29F8720dc465554c587e897dB);
    IERC20Upgradeable constant SLPETH = IERC20Upgradeable(0x8597fa0773888107E2867D36dd87Fe5bAFeAb328);
    IERC20Upgradeable constant ILVETH = IERC20Upgradeable(0x6a091a3406E0073C3CD6340122143009aDac0EDa);
    IERC20Upgradeable constant GHSTETH = IERC20Upgradeable(0xaB659deE3030602c1aF8C29D146fAcD4aeD6EC85);
    IERC20Upgradeable constant REVVETH = IERC20Upgradeable(0xc926990039045611eb1DE520C1E249Fd0d20a8eA);

    IRouter constant uRouter = IRouter(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); // Uniswap v2
    IRouter constant sRouter = IRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F); // Sushi
    IMasterChef constant sushiFarm = IMasterChef(0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd);
    IIlluvium constant illuvium = IIlluvium(0x8B4d8443a0229349A9892D4F7CbE89eF5f843F72);

    address public vault;

    // event here

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    function initialize() external initializer {
        __Ownable_init();

        WETH.safeApprove(address(sRouter), type(uint).max);
        WETH.safeApprove(address(uRouter), type(uint).max);

        AXS.safeApprove(address(sRouter), type(uint).max);
        SLP.safeApprove(address(sRouter), type(uint).max);
        ILV.safeApprove(address(sRouter), type(uint).max);
        GHST.safeApprove(address(uRouter), type(uint).max);
        REVV.safeApprove(address(sRouter), type(uint).max);
        MVI.safeApprove(address(uRouter), type(uint).max);

        AXSETH.safeApprove(address(sushiFarm), type(uint).max);
        ILVETH.safeApprove(address(illuvium), type(uint).max);

        AXSETH.safeApprove(address(sRouter), type(uint).max);
        SLPETH.safeApprove(address(sRouter), type(uint).max);
        ILVETH.safeApprove(address(sRouter), type(uint).max);
        GHSTETH.safeApprove(address(uRouter), type(uint).max);
        REVVETH.safeApprove(address(sRouter), type(uint).max);
    }

    function invest(uint WETHBal) external {
        WETH.safeTransferFrom(msg.sender, address(this), WETHBal);

        uint WETHBal1000 = WETHBal * 1000 / 10000;
        uint WETHBAL750 = WETHBal * 750 / 10000;
        uint WETHBal500 = WETHBal * 500 / 10000;

        // AXS-ETH (10%-10%)
        uint AXSBal = sushiSwap2(address(WETH), address(AXS), WETHBal1000);
        (,,uint slpAXSETHBal) = sRouter.addLiquidity(address(AXS), address(WETH), AXSBal, WETHBal1000, 0, 0, address(this), block.timestamp);
        sushiFarm.deposit(231, slpAXSETHBal);
        // SLP-ETH (7.5%-7.5%)
        uint SLPBal = sushiSwap2(address(WETH), address(SLP), WETHBAL750);
        sRouter.addLiquidity(address(SLP), address(WETH), SLPBal, WETHBAL750, 0, 0, address(this), block.timestamp);
        // ILV-ETH (10%-10%)
        uint ILVBal = sushiSwap2(address(WETH), address(ILV), WETHBal1000);
        (,,uint slpILVETHBal) = sRouter.addLiquidity(address(ILV), address(WETH), ILVBal, WETHBal1000, 0, 0, address(this), block.timestamp);
        illuvium.stake(slpILVETHBal, 0, false);
        // GHST-ETH (5%-5%)
        uint GHSTBal = uniSwap2(address(WETH), address(GHST), WETHBal500);
        uRouter.addLiquidity(address(GHST), address(WETH), GHSTBal, WETHBal500, 0, 0, address(this), block.timestamp);
        // REVV-ETH (5%-5%)
        uint REVVBal = sushiSwap2(address(WETH), address(REVV), WETHBal500);
        sRouter.addLiquidity(address(REVV), address(WETH), REVVBal, WETHBal500, 0, 0, address(this), block.timestamp);
        // MVI (25%)
        uniSwap2(address(WETH), address(MVI), WETHBal * 2500 / 10000);
    }

    /// @param amount Amount in ETH
    function withdraw(uint amount) external {
        
    }

    function sushiSwap2(address from, address to, uint amount) private returns (uint) {
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;
        return (sRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp))[1];
    }

    function uniSwap2(address from, address to, uint amount) private returns (uint) {
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;
        return (uRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp))[1];
    }
}