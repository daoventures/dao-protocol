pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IUniswapV2Router02.sol";
import "../../interfaces/IUniswapV2Pair.sol";
import "../../interfaces/ILPPool.sol";
import "../../interfaces/ILendingPool.sol";

contract moneyPrinterStrategy {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IERC20 DAI; //TODO add addresses
    IERC20 USDC;
    IERC20 USDT;

    IUniswapV2Router02 public router;
    IUniswapV2Router02 public shushiRouter;
    IUniswapV2Router02 public quickSwapRouter;
    ILPPool USDCUSDTQuickswapPool;
    ILPPool USDCDAIQuickswapPool;
    ILPPool USDCUSDTsushiswapPool;
    ILPPool USDCDAIsushiswapPool;
    ILendingPool aaveLendingPool;

    constructor() {}

    function deposit(uint _amount, IERC20 _token) external {
        _swapToDepositTokens(_amount, _token);
        _depositToSushi();
        _depositToquickSwap();
        _depositToCurve();
    }   


    function _swapToDepositTokens(uint _amount, IERC20 _token) internal {
        address [] memory path = new address[](2);
        path[0] = address(_token);
        path[1] = _token == DAI ? address(USDC) : address(DAI);
        uint sourceTokenAmount = _amount.mul(3333).div(10000);
        //replace with curve 
        router.swapExactTokensForTokens(sourceTokenAmount,0,path,address(this),block.timestamp);
        
        path[1] = _token == DAI ? address(USDT) : address(DAI);

        router.swapExactTokensForTokens(sourceTokenAmount,0,path,address(this),block.timestamp);

        //Deposit to AAvE to get aTokens //Check
        aaveLendingPool.deposit(address(DAI), sourceTokenAmount, address(this), 0);
        aaveLendingPool.deposit(address(USDC), sourceTokenAmount, address(this), 0);
        aaveLendingPool.deposit(address(USDT), sourceTokenAmount, address(this), 0);
    }

    function _depositToSushi() internal{
        uint usdcBalance = USDC.balanceOf(address(this));
        uint daiBalance = USDC.balanceOf(address(this));
        uint usdtBalance = USDC.balanceOf(address(this));

        (,,uint usdc_daipoolToken) = shushiRouter.addLiquidity(address(USDC), address(DAI), usdcBalance.mul(3333).div(10000), daiBalance.mul(3333).div(10000), 0, 0, address(this), block.timestamp);
        (,,uint usdt_usdcpoolToken) = shushiRouter.addLiquidity(address(USDC), address(USDT), usdcBalance.mul(3333).div(10000), usdtBalance.mul(3333).div(10000), 0, 0, address(this), block.timestamp);

        USDCUSDTsushiswapPool.stake(usdt_usdcpoolToken);
        USDCDAIsushiswapPool.stake(usdc_daipoolToken);
    }

    function _depositToquickSwap() internal{
        uint usdcBalance = USDC.balanceOf(address(this));
        uint daiBalance = USDC.balanceOf(address(this));
        uint usdtBalance = USDC.balanceOf(address(this));

        (,,uint usdc_daipoolToken) = quickSwapRouter.addLiquidity(address(USDC), address(DAI), usdcBalance.mul(3333).div(10000), daiBalance.mul(3333).div(10000), 0, 0, address(this), block.timestamp);
        (,,uint usdt_usdcpoolToken) = quickSwapRouter.addLiquidity(address(USDC), address(USDT), usdcBalance.mul(3333).div(10000), usdtBalance.mul(3333).div(10000), 0, 0, address(this), block.timestamp);

        USDCUSDTQuickswapPool.stake(usdt_usdcpoolToken);
        USDCDAIQuickswapPool.stake(usdc_daipoolToken);
    }

    function _depositToCurve() internal {
        //TODO
    }
}