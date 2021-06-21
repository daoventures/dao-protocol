pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/ICurveFi.sol";
import "../../interfaces/IUniswapV2Router02.sol";
import "../../interfaces/IUniswapV2Pair.sol";
import "../../interfaces/ILPPool.sol";
import "../../interfaces/ILendingPool.sol";
import "../../interfaces/ICurvePair.sol";
import "../../interfaces/IGauge.sol";
import "../../interfaces/WexPolyMaster.sol";

contract moneyPrinterStrategy {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    address vault;

    IERC20 DAI; //TODO add addresses
    IERC20 USDC;
    IERC20 USDT;
    IERC20 SUSHI;
    IERC20 MATIC;
    IERC20 CRV;
    IERC20 QUICK;
    IERC20 Wexpoly;
    IERC20 curveLpToken = IERC20(0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171);

    IUniswapV2Router02 public router;
    IUniswapV2Router02 public WexPolyRouter;
    IUniswapV2Router02 public quickSwapRouter;
    ILPPool USDCUSDTQuickswapPool;
    ILPPool USDCDAIQuickswapPool;
    ILPPool USDCUSDTsushiswapPool;
    ILPPool USDCDAIsushiswapPool;
    ILPPool DAIUSDTQuickswapPool;
    ILendingPool aaveLendingPool;
    ICurvePair curveAavePair;
    IGauge rewardGauge = IGauge(0xe381C25de995d62b453aF8B931aAc84fcCaa7A62);
    ICurveFi public curveFi = ICurveFi(0x445FE580eF8d70FF569aB36e80c647af338db351);
    //lpToken 0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171
    //Gauge 0xe381C25de995d62b453aF8B931aAc84fcCaa7A62
    //deposit to curve
    //depositLP tokens to gauge
    //claim from gauge


    WexPolyMaster public wexStakingContract;
    
        

    uint private daiInPool;
    uint private usdcInPool;
    uint private usdtInPool;
    uint private quickInPool;
    uint private sushiInPool;
    uint private maticInPool;
    uint usdtusdcWexPID = 9;

    mapping(address => int128) curveIds;

    constructor() {
        // curveIds[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = 2;
        // curveIds[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 3;
        // curveIds[0x6B175474E89094C44Da98b954EedeAC495271d0F] = 1;
    }

    function deposit(uint _amount, IERC20 _token) external {
        require(msg.sender == vault, "Only vault");
        _deposit(_amount, _token);
    }

    function _deposit(uint _amount, IERC20 _token) internal {
        _swapToDepositTokens(_amount, _token);

        uint daiToDeposit = (DAI.balanceOf(address(this))).div(2); //.mul(3333).div(10000);
        uint usdcToDeposit = (USDC.balanceOf(address(this))).div(2); //.mul(3333).div(10000);
        uint usdtToDeposit = (USDT.balanceOf(address(this))).div(3); //.mul(3333).div(10000);
        
        _depositToWexPoly(usdtToDeposit, usdcToDeposit);
        _depositToquickSwap(daiToDeposit, usdtToDeposit);
        _depositToCurve(daiToDeposit, usdtToDeposit, usdtToDeposit);
        // _depositToCurve(daiToDeposit, usdcToDeposit, usdtToDeposit);
    }   


/*     function deposit(uint _amount, IERC20 _token) public {
        _swapToDepositTokens(_amount, _token);

        uint daiToDeposit = (DAI.balanceOf(address(this))).mul(3333).div(10000);
        uint usdctoDeposit = (USDC.balanceOf(address(this))).mul(3333).div(10000);
        uint usdtToDeposit = (USDT.balanceOf(address(this))).mul(3333).div(10000);
        
        _depositToSushi(daiToDeposit, usdctoDeposit, usdtToDeposit);
        _depositToquickSwap(daiToDeposit, usdctoDeposit, usdtToDeposit);
        _depositToCurve(daiToDeposit, usdctoDeposit, usdtToDeposit);
    }   
 */
    function withdraw(uint _amount, IERC20 _token) external {
        require(msg.sender == vault, "Only vault");
        _withdrawFromWexPoly(_amount);
        _withdrawFromquickSwap(_amount);

        uint daiBalance = DAI.balanceOf(address(this));
        uint usdcBalance = USDC.balanceOf(address(this));
        uint usdtBalance = USDT.balanceOf(address(this));

        usdtInPool = usdtInPool.sub(usdtBalance);
        usdcInPool = usdcInPool.sub(usdcBalance);
        daiInPool = daiInPool.sub(daiBalance);

        //convert to _token 
        curveFi.exchange_underlying(curveIds[address(DAI)], curveIds[address(_token)], daiBalance, 0);
        curveFi.exchange_underlying(curveIds[address(USDC)], curveIds[address(_token)], usdcBalance, 0);
        curveFi.exchange_underlying(curveIds[address(USDT)], curveIds[address(_token)], usdtBalance, 0);

        _token.safeTransfer(address(vault), _token.balanceOf(address(this)));
    }

    function harvest() external {
        _harvestFromWexPoly();
        _harvestFromQuick();
        _harvestFromCurve();

        _deposit(DAI.balanceOf(address(this)), DAI);
    }

    function _withdrawFromWexPoly(uint _amount) internal {
        uint USDCUSDTLpToken = wexStakingContract.pendingWex(usdtusdcWexPID, address(this)).mul(_amount).div(getValueInPool());
        wexStakingContract.withdraw(usdtusdcWexPID, USDCUSDTLpToken, false);

        WexPolyRouter.removeLiquidity(address(USDT), address(USDC), USDCUSDTLpToken, 0, 0, address(this), block.timestamp);
        
    }

/*     function _withdrawFromSushi(uint _amount) internal {
        uint USDCUSDTsushiLpToken = USDCUSDTsushiswapPool.balanceOf(address(this)).mul(_amount).div(getValueInPool());
        uint USDCDAIsushiLpToken = USDCDAIsushiswapPool.balanceOf(address(this)).mul(_amount).div(getValueInPool());

        USDCUSDTsushiswapPool.withdraw(USDCUSDTsushiLpToken);
        USDCDAIsushiswapPool.withdraw(USDCDAIsushiLpToken);
    } */

/*     function _withdrawFromquickSwap(uint _amount) internal {
        uint USDCUSDTQuickLPToken = USDCUSDTQuickswapPool.balanceOf(address(this)).mul(_amount).div(getValueInPool());
        uint USDCDAIQuickLpToken = USDCDAIQuickswapPool.balanceOf(address(this)).mul(_amount).div(getValueInPool());

        USDCUSDTQuickswapPool.withdraw(USDCUSDTQuickLPToken);
        USDCDAIQuickswapPool.withdraw(USDCDAIQuickLpToken);
    } */

    function _withdrawFromquickSwap(uint _amount) internal {
        uint DAIUSDTQuickLpToken = DAIUSDTQuickswapPool.balanceOf(address(this)).mul(_amount).div(getValueInPool());

        USDCUSDTQuickswapPool.withdraw(DAIUSDTQuickLpToken);
        quickSwapRouter.removeLiquidity(address(DAI), address(USDT), DAIUSDTQuickLpToken, 0, 0, address(this), block.timestamp);
    }

/*     function _harvestFromSushi() internal {
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
 */
    function _harvestFromWexPoly() internal {
        uint WexpolyEarned = wexStakingContract.pendingWex(usdtusdcWexPID, address(this));
        wexStakingContract.claim(usdtusdcWexPID);

        address[] memory path = new address[](2);
        path[0] = address(Wexpoly);
        path[1] = address(DAI);
     
        router.swapExactTokensForTokens(WexpolyEarned, 0, path, address(this), block.timestamp);
    }
/* 
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
    } */


    function _harvestFromQuick() internal {

        DAIUSDTQuickswapPool.getReward();

        uint quickBalance = QUICK.balanceOf(address(this));
        // quickInPool = quickInPool.add(quickBalance); //check decimals

        address[] memory path = new address[](2);
        path[0] = address(QUICK);
        path[1] = address(DAI);

        router.swapExactTokensForTokens(quickBalance, 0, path, address(this), block.timestamp);
    }

    function _harvestFromCurve() internal {
        rewardGauge.claim_reward();

        address[] memory path = new address[](2);
        path[0] = address(MATIC);
        path[1] = address(DAI);

        quickSwapRouter.swapExactTokensForTokens(MATIC.balanceOf(address(this)), 0, path, address(this), block.timestamp);

        path[0] = address(CRV);
        quickSwapRouter.swapExactTokensForTokens(CRV.balanceOf(address(this)), 0, path, address(this), block.timestamp);
    }

    function _swapToDepositTokens(uint _amount, IERC20 _token) internal {
        if(_token == USDT) {
            //convert 27.77% to DAI and 22.77% to USDC
            uint amountToSwap = _amount.mul(2277).div(10000);
            curveFi.exchange_underlying(curveIds[address(_token)], curveIds[address(DAI)], amountToSwap, 0);
            curveFi.exchange_underlying(curveIds[address(_token)], curveIds[address(USDC)], amountToSwap, 0);
        }else  {
            //convert 72.21% to USDT
            //27.77% to DAI || USDC depending on the deposit token
            uint amountToUSDT = _amount.mul(7221).div(10000);

            address _tokenToGet = _token == DAI ? address(USDC) : address(DAI); //return USDC if sourceToken is DAI, else return DAI.
            curveFi.exchange_underlying(curveIds[address(_token)], curveIds[address(USDT)], amountToUSDT, 0);
            curveFi.exchange_underlying(curveIds[address(_token)], curveIds[_tokenToGet], _amount.sub(amountToUSDT), 0);
        }
    }

/*     function _swapToDepositTokens(uint _amount, IERC20 _token) internal {
        //changes - convert 33% of input tokens to USDT and USDC
        //if DAI -> convert 33% to usdc and usdt else
        //path[1] = _token == USDC ? address(USDC) : address(USDT);


        //convert another 33% to DAI USDT
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
    } */
    function _depositToWexPoly(uint _usdtAmount, uint _usdcAmount) internal{
        usdcInPool = usdcInPool.add(_usdcAmount.mul(1e12));
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));

        (,,uint usdt_usdcpoolToken) = WexPolyRouter.addLiquidity(address(USDC), address(USDT), _usdcAmount, _usdtAmount, 0, 0, address(this), block.timestamp);

        wexStakingContract.deposit(usdtusdcWexPID, usdt_usdcpoolToken, false);
        //deposit to wexPoly
    }

    function _depositToquickSwap(uint _daiAmount, uint _usdtAmount) internal{
        daiInPool = daiInPool.add(_daiAmount);
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));
        
        (,,uint usdc_usdtpoolToken) = quickSwapRouter.addLiquidity(address(DAI), address(USDT), _daiAmount, _usdtAmount, 0, 0, address(this), block.timestamp);

        DAIUSDTQuickswapPool.stake(usdc_usdtpoolToken);
    }
/*     function _depositToSushi(uint _daiAmount, uint _usdcAmount, uint _usdtAmount) internal{
        daiInPool = daiInPool.add(_daiAmount);
        usdcInPool = usdcInPool.add(_usdcAmount.mul(1e12));
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));

        (,,uint usdc_daipoolToken) = shushiRouter.addLiquidity(address(USDC), address(DAI), _usdcAmount, _daiAmount, 0, 0, address(this), block.timestamp);
        (,,uint usdt_usdcpoolToken) = shushiRouter.addLiquidity(address(USDC), address(USDT), _usdcAmount, _usdtAmount, 0, 0, address(this), block.timestamp);

        USDCUSDTsushiswapPool.stake(usdt_usdcpoolToken);
        USDCDAIsushiswapPool.stake(usdc_daipoolToken);
    } */
/* 
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
 */

    function _depositToCurve(uint _daiAmount, uint _usdcAmount, uint _usdtAmount) internal {
        daiInPool = daiInPool.add(_daiAmount);
        usdcInPool = usdcInPool.add(_usdcAmount.mul(1e12));
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));

        uint[3] memory amounts;
        amounts[0] = _daiAmount;
        amounts[1] = _usdcAmount;
        amounts[2] = _usdtAmount;
        
        curveAavePair.add_liquidity(amounts, 0, true);
        //deposit to gauge
        rewardGauge.deposit(curveLpToken.balanceOf(address(this)));
        
    }

    function getValueInPool() public view returns (uint) {
        return daiInPool.add(usdcInPool.add(usdtInPool));
    }
}