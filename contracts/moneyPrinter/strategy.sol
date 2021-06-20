pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IUniswapV2Router02.sol";
import "../../interfaces/IUniswapV2Pair.sol";
import "../../interfaces/ILPPool.sol";
import "../../interfaces/ILendingPool.sol";
import "../../interfaces/IAAVEPOOL.sol";

contract moneyPrinterStrategy {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IERC20 DAI; //TODO add addresses
    IERC20 USDC;
    IERC20 USDT;
    IERC20 SUSHI;
    IERC20 MATIC;
    IERC20 QUICK;

    IUniswapV2Router02 public router;
    IUniswapV2Router02 public shushiRouter;
    IUniswapV2Router02 public quickSwapRouter;
    ILPPool USDCUSDTQuickswapPool;
    ILPPool USDCDAIQuickswapPool;
    ILPPool USDCUSDTsushiswapPool;
    ILPPool USDCDAIsushiswapPool;
    ILendingPool aaveLendingPool;
    IAAVEPOOL aavePool;

    uint private daiInPool;
    uint private usdcInPool;
    uint private usdtInPool;
    uint private quickInPool;
    uint private sushiInPool;
    uint private maticInPool;

    constructor() {}

    function deposit(uint _amount, IERC20 _token) public {
        _swapToDepositTokens(_amount, _token);

        uint daiToDeposit = (DAI.balanceOf(address(this))).mul(3333).div(10000);
        uint usdctoDeposit = (USDC.balanceOf(address(this))).mul(3333).div(10000);
        uint usdtToDeposit = (USDT.balanceOf(address(this))).mul(3333).div(10000);
        
        _depositToSushi(daiToDeposit, usdctoDeposit, usdtToDeposit);
        _depositToquickSwap(daiToDeposit, usdctoDeposit, usdtToDeposit);
        _depositToCurve(daiToDeposit, usdctoDeposit, usdtToDeposit);
    }   

    function withdraw(uint _amount, IERC20 _token) external {
        _withdrawFromSushi(_amount);
        //TODO

        usdtInPool = usdtInPool.sub(USDT.balanceOf(address(this)));

        //convert to _token
    }

    function harvest() external {
        _harvestFromSushi();
        _harvestFromQuick();
        //_harvestFromCurve();// TODO

        deposit(DAI.balanceOf(address(this)), DAI);
    }

    function _withdrawFromSushi(uint _amount) internal {
        uint USDCUSDTsushiLpToken = USDCUSDTsushiswapPool.balanceOf(address(this)).mul(_amount).div(getValueInPool());
        uint USDCDAIsushiLpToken = USDCDAIsushiswapPool.balanceOf(address(this)).mul(_amount).div(getValueInPool());

        USDCUSDTsushiswapPool.withdraw(USDCUSDTsushiLpToken);
        USDCDAIsushiswapPool.withdraw(USDCDAIsushiLpToken);
    }

    function _harvestFromSushi() internal {
        // USDCUSDTsushiswapPool.withdraw(USDCUSDTsushiswapPool.earned(address(this)));
        // USDCDAIsushiswapPool.withdraw(USDCDAIsushiswapPool.earned(address(this)));
        USDCDAIsushiswapPool.getReward();
        USDCDAIsushiswapPool.getReward();

        uint sushiBalance = SUSHI.balanceOf(address(this));
        uint maticBalance = MATIC.balanceOf(address(this));

        // sushiInPool = sushiInPool.add(sushiBalance); //checkDecimals
        // maticInPool = maticInPool.add(maticBalance);

        address[] memory path = new address[](2);
        path[0] = address(SUSHI);
        path[1] = address(DAI);
        router.swapExactTokensForTokens(sushiBalance, 0, path, address(this), block.timestamp);

        path[0] = address(MATIC);
        router.swapExactTokensForTokens(maticBalance, 0, path, address(this), block.timestamp);
    }

    function _harvestFromQuick() internal {
        // USDCUSDTQuickswapPool.withdraw(USDCUSDTQuickswapPool.earned(address(this)));
        // USDCDAIQuickswapPool.withdraw(USDCDAIQuickswapPool.earned(address(this)));

        USDCUSDTQuickswapPool.getReward();
        USDCDAIQuickswapPool.getReward();

        uint quickBalance = QUICK.balanceOf(address(this));
        // quickInPool = quickInPool.add(quickBalance); //check decimals

        address[] memory path = new address[](2);
        path[0] = address(QUICK);
        path[1] = address(DAI);

        router.swapExactTokensForTokens(quickBalance, 0, path, address(this), block.timestamp);
    }

    function _harvestFromCurve() internal {
        //TODO
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
        // aaveLendingPool.deposit(address(DAI), sourceTokenAmount, address(this), 0);
        // aaveLendingPool.deposit(address(USDC), sourceTokenAmount, address(this), 0);
        // aaveLendingPool.deposit(address(USDT), sourceTokenAmount, address(this), 0);
    }

    function _depositToSushi(uint _daiAmount, uint _usdcAmount, uint _usdtAmount) internal{
        daiInPool = daiInPool.add(_daiAmount);
        usdcInPool = usdcInPool.add(_usdcAmount.mul(1e12));
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));

        (,,uint usdc_daipoolToken) = shushiRouter.addLiquidity(address(USDC), address(DAI), _usdcAmount, _daiAmount, 0, 0, address(this), block.timestamp);
        (,,uint usdt_usdcpoolToken) = shushiRouter.addLiquidity(address(USDC), address(USDT), _usdcAmount, _usdtAmount, 0, 0, address(this), block.timestamp);

        USDCUSDTsushiswapPool.stake(usdt_usdcpoolToken);
        USDCDAIsushiswapPool.stake(usdc_daipoolToken);
    }

    function _depositToquickSwap(uint _daiAmount, uint _usdcAmount, uint _usdtAmount) internal{
        daiInPool = daiInPool.add(_daiAmount);
        usdcInPool = usdcInPool.add(_usdcAmount.mul(1e12));
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));
        
        (,,uint usdc_daipoolToken) = quickSwapRouter.addLiquidity(address(USDC), address(DAI), _usdcAmount, _daiAmount, 0, 0, address(this), block.timestamp);
        (,,uint usdt_usdcpoolToken) = quickSwapRouter.addLiquidity(address(USDC), address(USDT), _usdcAmount, _usdtAmount, 0, 0, address(this), block.timestamp);

        USDCUSDTQuickswapPool.stake(usdt_usdcpoolToken);
        USDCDAIQuickswapPool.stake(usdc_daipoolToken);
    }

    function _depositToCurve(uint _daiAmount, uint _usdcAmount, uint _usdtAmount) internal {
        daiInPool = daiInPool.add(_daiAmount);
        usdcInPool = usdcInPool.add(_usdcAmount.mul(1e12));
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));
        
        uint[3] memory amounts;
        amounts[0] = _daiAmount;
        amounts[1] = _usdcAmount;
        amounts[2] = _usdtAmount;
        aavePool.add_liquidity(amounts, 0, true);
    }

    function getValueInPool() public view returns (uint) {
        return daiInPool.add(usdcInPool.add(usdtInPool));
    }
}