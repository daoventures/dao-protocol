// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../libs/BaseRelayRecipient.sol";
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

    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface IPair is IERC20Upgradeable {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IUniV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external returns (uint256 amountOut);
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
    function withdraw(uint amount) external;
}

interface IDaoL1Vault is IERC20Upgradeable {
    function deposit(uint amount) external;
    function withdraw(uint share) external;
    function getPricePerFullShare(bool) external view returns (uint);
}

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

contract MVFVault is Initializable, ERC20Upgradeable, OwnableUpgradeable, 
        ReentrancyGuardUpgradeable, PausableUpgradeable, BaseRelayRecipient {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IWETH;
    using SafeERC20Upgradeable for IPair;

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
    IERC20Upgradeable constant SLPETH = IERC20Upgradeable(0x0CfBeD8f2248D2735203f602BE0cAe5a3131ec68);
    IERC20Upgradeable constant ILVETH = IERC20Upgradeable(0x6a091a3406E0073C3CD6340122143009aDac0EDa);
    IERC20Upgradeable constant GHSTETH = IERC20Upgradeable(0xFbA31F01058DB09573a383F26a088f23774d4E5d);
    IPair constant REVVETH = IPair(0x724d5c9c618A2152e99a45649a3B8cf198321f46);

    IRouter constant uniV2Router = IRouter(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); // Uniswap v2
    IUniV3Router uniV3Router = IUniV3Router(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IRouter constant sushiRouter = IRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F); // Sushi

    address public vault;
    IDaoL1Vault public AXSETHVault;
    IDaoL1Vault public SLPETHVault;
    IDaoL1Vault public ILVETHVault;
    IDaoL1Vault public GHSTETHVault;

    uint256[] public networkFeeTier2;
    uint256 public customNetworkFeeTier;
    uint256[] public networkFeePerc;
    uint256 public customNetworkFeePerc;
    uint256 private _fees;

    uint public watermark;
    uint public fees;

    // event here

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    function initialize(address _AXSETHVault, address _SLPETHVault, address _ILVETHVault, address _GHSTETHVault) external initializer {
        __Ownable_init();

        AXSETHVault = IDaoL1Vault(_AXSETHVault);
        SLPETHVault = IDaoL1Vault(_SLPETHVault);
        ILVETHVault = IDaoL1Vault(_ILVETHVault);
        GHSTETHVault = IDaoL1Vault(_GHSTETHVault);

        WETH.safeApprove(address(sushiRouter), type(uint).max);
        WETH.safeApprove(address(uniV2Router), type(uint).max);
        WETH.safeApprove(address(uniV3Router), type(uint).max);

        AXS.safeApprove(address(sushiRouter), type(uint).max);
        // SLP.safeApprove(address(sushiRouter), type(uint).max);
        ILV.safeApprove(address(sushiRouter), type(uint).max);
        GHST.safeApprove(address(uniV3Router), type(uint).max);
        SLP.safeApprove(address(uniV3Router), type(uint).max);
        REVV.safeApprove(address(uniV2Router), type(uint).max);
        MVI.safeApprove(address(uniV2Router), type(uint).max);

        AXSETH.safeApprove(address(sushiRouter), type(uint).max);
        AXSETH.safeApprove(address(AXSETHVault), type(uint).max);
        ILVETH.safeApprove(address(sushiRouter), type(uint).max);
        ILVETH.safeApprove(address(ILVETHVault), type(uint).max);
    }

    function deposit(uint amount, IERC20Upgradeable token) external {
        require(amount > 0, "Amount must > 0");

        uint pool = getAllPoolInUSD();
        token.safeTransfer(address(this), amount);

        uint256 _networkFeePerc;
        if (amount < networkFeeTier2[0]) _networkFeePerc = networkFeePerc[0]; // Tier 1
        else if (amount <= networkFeeTier2[1]) _networkFeePerc = networkFeePerc[1]; // Tier 2
        else if (amount < customNetworkFeeTier) _networkFeePerc = networkFeePerc[2]; // Tier 3
        else _networkFeePerc = customNetworkFeePerc; // Custom Tier
        uint256 fee = amount * _networkFeePerc / 10000;
        fees = fees + fee;
        amount = amount - fee;

        uint256 _totalSupply = totalSupply();
        uint256 share = _totalSupply == 0 ? amount : amount * _totalSupply / pool;
        _mint(msg.sender, share);
    }

    // function withdraw(uint share) external {

    // }

    function invest(uint WETHAmt) external {
        WETH.safeTransferFrom(msg.sender, address(this), WETHAmt);

        uint WETHAmt1000 = WETHAmt * 1000 / 10000;
        uint WETHAmt750 = WETHAmt * 750 / 10000;
        uint WETHAmt500 = WETHAmt * 500 / 10000;

        // AXS-ETH (10%-10%)
        // investAXSETH(WETHAmt1000);

        // SLP-ETH (7.5%-7.5%)
        // investSLPETH(WETHAmt750);

        // ILV-ETH (10%-10%)
        // investILVETH(WETHAmt1000);

        // GHST-ETH (5%-5%)
        // investGHSTETH(WETHAmt500);

        // REVV-ETH (5%-5%)
        // investREVVETH(WETHAmt500);

        // MVI (25%)
        investMVI(WETHAmt * 2500 / 10000);
    }

    function investAXSETH(uint WETHAmt) private {
        uint AXSAmt = sushiSwap(address(WETH), address(AXS), WETHAmt);
        (,,uint AXSETHLpAmt) = sushiRouter.addLiquidity(address(AXS), address(WETH), AXSAmt, WETHAmt, 0, 0, address(this), block.timestamp);
        AXSETHVault.deposit(AXSETHLpAmt);
    }

    function investSLPETH(uint WETHAmt) private {
        uint SLPAmt = uniV3Swap(address(WETH), address(SLP), 3000, WETHAmt);
        // Add(increase) liquidity into L1 SLPETH vault directly
    }

    function investILVETH(uint WETHAmt) private {
        uint ILVAmt = sushiSwap(address(WETH), address(ILV), WETHAmt);
        (,,uint ILVETHAmt) = sushiRouter.addLiquidity(address(ILV), address(WETH), ILVAmt, WETHAmt, 0, 0, address(this), block.timestamp);
        ILVETHVault.deposit(ILVETHAmt);
    }

    function investGHSTETH(uint WETHAmt) private {
        uint GHSTAmt = uniV3Swap(address(WETH), address(GHST), 10000, WETHAmt);
        // Add(increase) liquidity into L1 SLPETH vault directly
    }

    function investREVVETH(uint WETHAmt) private {
        uint REVVAmt = uniV2Swap(address(WETH), address(REVV), WETHAmt);
        uniV2Router.addLiquidity(address(REVV), address(WETH), REVVAmt, WETHAmt, 0, 0, address(this), block.timestamp);
    }

    function investMVI(uint WETHAmt) private {
        uniV2Swap(address(WETH), address(MVI), WETHAmt);
    }

    function sushiSwap(address from, address to, uint amount) private returns (uint) {
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;
        return (sushiRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp))[1];
    }

    function uniV2Swap(address from, address to, uint amount) private returns (uint) {
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;
        return (uniV2Router.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp))[1];
    }

    function uniV3Swap(address tokenIn, address tokenOut, uint24 fee, uint amountIn) private returns (uint amountOut) {
        IUniV3Router.ExactInputSingleParams memory params =
            IUniV3Router.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
        amountOut = uniV3Router.exactInputSingle(params);
    }

    function collectProfit() external {

    }

    function _msgSender() internal override(ContextUpgradeable, BaseRelayRecipient) view returns (address) {
        return BaseRelayRecipient._msgSender();
    }
    
    function versionRecipient() external pure override returns (string memory) {
        return "1";
    }

    function getPath(address tokenA, address tokenB) private pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
    }

    function getETHPriceInUSD() private view returns (uint) {
        return uint(IChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419).latestAnswer()); // 8 decimals
    }

    function getAXSETHPoolInUSD() private view returns (uint) {
        uint pricePerFullShareInUSD = AXSETHVault.getPricePerFullShare(true);
        return AXSETHVault.balanceOf(address(this)) * 1e18 / pricePerFullShareInUSD;
    }

    function getSLPETHPoolInUSD() private view returns (uint) {
        uint pricePerFullShareInUSD = SLPETHVault.getPricePerFullShare(true);
        return SLPETHVault.balanceOf(address(this)) * 1e18 / pricePerFullShareInUSD;
    }

    function getILVETHPoolInUSD() private view returns (uint) {
        uint pricePerFullShareInUSD = ILVETHVault.getPricePerFullShare(true);
        return ILVETHVault.balanceOf(address(this)) * 1e18 / pricePerFullShareInUSD;
    }

    function getGHSTETHPoolInUSD() private view returns (uint) {
        uint pricePerFullShareInUSD = GHSTETHVault.getPricePerFullShare(true);
        return GHSTETHVault.balanceOf(address(this)) * 1e18 / pricePerFullShareInUSD;
    }

    function getREVVETHPoolInUSD(uint ETHPriceInUSD) private view returns (uint) {
        uint REVVPriceInETH = (uniV2Router.getAmountsOut(1e18, getPath(address(REVV), address(WETH))))[1];
        (uint112 reserveREVV, uint112 reserveWETH,) = REVVETH.getReserves();
        uint totalReserveInETH = reserveREVV * REVVPriceInETH / 1e18 + reserveWETH;
        return totalReserveInETH * ETHPriceInUSD / 1e8; // 18 decimals
    }

    function getMVIPoolInUSD(uint ETHPriceInUSD) private view returns (uint) {
        uint MVIPriceInETH = (uniV2Router.getAmountsOut(1e18, getPath(address(MVI), address(WETH))))[1];
        uint totalMVIInETH = MVIPriceInETH * MVI.balanceOf(address(this)) / 1e18;
        return totalMVIInETH * ETHPriceInUSD / 1e8; // 18 decimals
    }

    function getAllPoolInUSD() public view returns (uint) {
        uint ETHPriceInUSD = getETHPriceInUSD();

        uint AXSETHPoolInUSD = getAXSETHPoolInUSD();
        uint SLPETHPoolInUSD = getSLPETHPoolInUSD();
        uint ILVETHPoolInUSD = getILVETHPoolInUSD();
        uint GHSTETHPoolInUSD = getGHSTETHPoolInUSD();
        uint REVVETHPoolInUSD = getREVVETHPoolInUSD(ETHPriceInUSD);
        uint MVIPoolInUSD = getMVIPoolInUSD(ETHPriceInUSD);

        uint tokenKeepInVault = USDT.balanceOf(address(this)) * 1e12 +
            USDC.balanceOf(address(this)) * 1e12 + DAI.balanceOf(address(this));
        
        return AXSETHPoolInUSD + SLPETHPoolInUSD + ILVETHPoolInUSD +
            GHSTETHPoolInUSD + REVVETHPoolInUSD + MVIPoolInUSD + tokenKeepInVault;
    }
}