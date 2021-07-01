// SPDX-License-Identifier: MIT
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
import "../../interfaces/IGauge.sol";
import "../../interfaces/WexPolyMaster.sol";

import "hardhat/console.sol";

contract MoneyPrinterStrategy is Ownable{
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    address public vault;
    address public treasury;

    IERC20 public constant DAI = IERC20(0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063); 
    IERC20 public constant USDC = IERC20(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174);
    IERC20 public constant USDT = IERC20(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);
    
    IERC20 public constant MATIC = IERC20(0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270);
    IERC20 public constant CRV = IERC20(0x172370d5Cd63279eFa6d502DAB29171933a610AF);
    IERC20 public constant QUICK = IERC20(0x831753DD7087CaC61aB5644b308642cc1c33Dc13);
    IERC20 public constant Wexpoly = IERC20(0x4c4BF319237D98a30A929A96112EfFa8DA3510EB);
    IERC20 public constant curveLpToken = IERC20(0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171);

    
    IUniswapV2Router02 public constant WexPolyRouter = IUniswapV2Router02(0x3a1D87f206D12415f5b0A33E786967680AAb4f6d);
    IUniswapV2Router02 public constant quickSwapRouter = IUniswapV2Router02(0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff);
    ILPPool public constant DAIUSDTQuickswapPool = ILPPool(0x97Efe8470727FeE250D7158e6f8F63bb4327c8A2);
    
    IGauge public constant rewardGauge = IGauge(0xe381C25de995d62b453aF8B931aAc84fcCaa7A62);
    ICurveFi public constant curveFi = ICurveFi(0x445FE580eF8d70FF569aB36e80c647af338db351);
    
    WexPolyMaster public constant wexStakingContract = WexPolyMaster(0xC8Bd86E5a132Ac0bf10134e270De06A8Ba317BFe);
    IUniswapV2Pair public constant WexUSDT_USDCPair = IUniswapV2Pair(0x7242e19A0937ac33472febD69462668a4cf5bbC5);
    IUniswapV2Pair public constant QuickDAI_USDTPair = IUniswapV2Pair(0x59153f27eeFE07E5eCE4f9304EBBa1DA6F53CA88);
        

    uint private daiInPool;
    uint private usdcInPool;
    uint private usdtInPool;
    uint private quickInPool;
    uint private sushiInPool;
    uint private maticInPool;
    uint private amountDeposited;
    uint usdtusdcWexPID = 9;

    mapping(IERC20 => int128) curveIds;

    constructor(address _treasury) {
        curveIds[DAI] = 0;
        curveIds[USDC] = 1;
        curveIds[USDT] = 2;
        
        DAI.approve(address(WexPolyRouter), type(uint).max);
        DAI.approve(address(quickSwapRouter), type(uint).max);
        DAI.approve(address(curveFi), type(uint).max);
        USDC.approve(address(WexPolyRouter), type(uint).max);
        USDC.approve(address(quickSwapRouter), type(uint).max);
        USDC.approve(address(curveFi), type(uint).max);
        USDT.approve(address(WexPolyRouter), type(uint).max);
        USDT.approve(address(quickSwapRouter), type(uint).max);
        USDT.approve(address(curveFi), type(uint).max);
        CRV.approve(address(quickSwapRouter), type(uint).max);
        MATIC.approve(address(quickSwapRouter), type(uint).max);
        QUICK.approve(address(quickSwapRouter), type(uint).max);
        Wexpoly.approve(address(quickSwapRouter), type(uint).max);
        curveLpToken.approve(address(rewardGauge), type(uint).max);
        curveLpToken.approve(address(curveFi), type(uint).max);
        WexUSDT_USDCPair.approve(address(wexStakingContract), type(uint).max);
        WexUSDT_USDCPair.approve(address(WexPolyRouter), type(uint).max);
        QuickDAI_USDTPair.approve(address(DAIUSDTQuickswapPool), type(uint).max);
        QuickDAI_USDTPair.approve(address(quickSwapRouter), type(uint).max);

        treasury= _treasury;
    }

    modifier onlyVault {
        require(msg.sender == vault, "Only Vault");
        _;
    }

    function deposit(uint _amount, IERC20 _token) external onlyVault{
        _token.safeTransferFrom(vault, address(this), _amount);
        if(_token == DAI) {
            amountDeposited = amountDeposited.add(_amount);
        } else {
            amountDeposited = amountDeposited.add(_amount.mul(1e12));
        }
        _deposit(_amount, _token);


        console.log("usdc-afterDeposit", USDC.balanceOf(address(this)));
        console.log("dai-afterDeposit", DAI.balanceOf(address(this)));
        console.log("usdt-afterDeposit", USDT.balanceOf(address(this)));
    }

    function _deposit(uint _amount, IERC20 _token) internal {
        _swapToDepositTokens(_amount, _token);

        uint daiToDeposit = (DAI.balanceOf(address(this))).div(2); //.mul(3333).div(10000);
        uint usdcToDeposit = (USDC.balanceOf(address(this))).div(2); //.mul(3333).div(10000);
        uint usdtToDeposit = (USDT.balanceOf(address(this))).div(3); //.mul(3333).div(10000);
        console.log("usdc", USDC.balanceOf(address(this)), usdcToDeposit);
        console.log("dai", DAI.balanceOf(address(this)),daiToDeposit);
        console.log("usdt", USDT.balanceOf(address(this)),usdtToDeposit);
        _depositToWexPoly(usdtToDeposit, usdcToDeposit);
        _depositToquickSwap(daiToDeposit, usdtToDeposit);
        _depositToCurve(daiToDeposit, usdcToDeposit, usdtToDeposit);
    }   


    function withdraw(uint _amount, IERC20 _token) external onlyVault{
        
        (uint usdtFromwSwap, uint usdcFromwSwap) = _withdrawFromWexPoly(_amount);
        (uint daiFromQSwap, uint usdtFromQSwap) = _withdrawFromquickSwap(_amount);
        (uint daiFromCurve, uint usdcFromCurve, uint usdtFromCurve) = _withdrawFromCurve(_amount);

        uint daiBalance =  daiFromQSwap.add(daiFromCurve); 
        uint usdcBalance = usdcFromwSwap.add(usdcFromCurve);
        uint usdtBalance = usdtFromQSwap.add(usdtFromCurve).add(usdtFromwSwap);

        usdtInPool = usdtBalance < usdtInPool ? usdtInPool.sub(usdtBalance): 0;
        usdcInPool = usdcBalance < usdcInPool ? usdcInPool.sub(usdcBalance): 0;
        daiInPool = daiBalance < daiInPool ? daiInPool.sub(daiBalance): 0;

        //convert to _token 

        if(_token != DAI)
        curveFi.exchange_underlying(curveIds[DAI], curveIds[_token], daiBalance, 0);
        if(_token != USDC)
        curveFi.exchange_underlying(curveIds[USDC], curveIds[_token], usdcBalance, 0);
        if(_token != USDT)
        curveFi.exchange_underlying(curveIds[USDT], curveIds[_token], usdtBalance, 0);

        amountDeposited = _amount < amountDeposited ? amountDeposited.sub(_amount) : 0;
        _token.safeTransfer(address(vault), _token.balanceOf(address(this)));
    }

    function harvest() external onlyVault {
        
        _harvestFromWexPoly();
        _harvestFromQuick();
        _harvestFromCurve();

        DAI.transfer(treasury, DAI.balanceOf(address(this)).mul(10).div(100));//10% to treasury
        _deposit(DAI.balanceOf(address(this)), DAI);
    }

    function migrateFunds(IERC20 _token)external onlyVault{

        //withdraw from wexPoly
        (uint amountStaked,,) = wexStakingContract.userInfo(usdtusdcWexPID, address(this));
        wexStakingContract.withdraw(usdtusdcWexPID, amountStaked, false);
        WexPolyRouter.removeLiquidity(address(USDT), address(USDC), amountStaked, 0, 0, address(this), block.timestamp);

        //withdraw from quickSwap
        uint lpTokenBalanceQSwap = DAIUSDTQuickswapPool.balanceOf(address(this));
        DAIUSDTQuickswapPool.withdraw(lpTokenBalanceQSwap);
        quickSwapRouter.removeLiquidity(address(DAI), address(USDT), lpTokenBalanceQSwap, 0, 0, address(this), block.timestamp);

        //withdraw from curve
        uint lpTokenBalanceCurve = rewardGauge.balanceOf(address(this));
        rewardGauge.withdraw(lpTokenBalanceCurve);
        uint[3] memory minAMmounts; //
        minAMmounts[0] = 0;
        minAMmounts[1] = 0;
        minAMmounts[2] = 0;
        curveFi.remove_liquidity(lpTokenBalanceCurve, minAMmounts, true);


        //swap and withdraw
        if(_token != DAI)
        curveFi.exchange_underlying(curveIds[DAI], curveIds[_token], DAI.balanceOf(address(this)), 0);
        if(_token != USDC)
        curveFi.exchange_underlying(curveIds[USDC], curveIds[_token], USDC.balanceOf(address(this)), 0);
        if(_token != USDT)
        curveFi.exchange_underlying(curveIds[USDT], curveIds[_token], USDT.balanceOf(address(this)), 0);

        //All funds are withdrawn, so vaules are set to 0.
        daiInPool = 0;
        usdcInPool = 0;
        usdtInPool = 0;
        quickInPool = 0;
        sushiInPool = 0;
        maticInPool = 0;
        amountDeposited = 0;

        _token.safeTransfer(address(vault), _token.balanceOf(address(this)));

    }

    function _withdrawFromWexPoly(uint _amount) internal returns (uint _withdrawnUSDT, uint _withdrawnUSDC){
        (uint amountStaked,,) = wexStakingContract.userInfo(usdtusdcWexPID, address(this));
        
        // uint USDCUSDTLpToken = amountStaked.mul(_amount).div(getValueInPool());
        uint USDCUSDTLpToken = amountStaked.mul(_amount).div(amountDeposited);
        USDCUSDTLpToken = USDCUSDTLpToken > amountStaked ? amountStaked : USDCUSDTLpToken;
        wexStakingContract.withdraw(usdtusdcWexPID, USDCUSDTLpToken, false);
        console.log('USDCUSDTLpToken',USDCUSDTLpToken, amountStaked, amountDeposited);
        console.log('balance-USDCUSDTLpToken', WexUSDT_USDCPair.balanceOf(address(this)));
        
        (_withdrawnUSDT, _withdrawnUSDC) = WexPolyRouter.removeLiquidity(address(USDT), address(USDC), USDCUSDTLpToken, 0, 0, address(this), block.timestamp);
        
    }

    function _withdrawFromquickSwap(uint _amount) internal returns(uint _withdrawnDAI, uint _withdrawnUSDT){
        console.log('DAIUSDTQuickswapPool', DAIUSDTQuickswapPool.balanceOf(address(this)), DAIUSDTQuickswapPool.balanceOf(address(this)).mul(_amount).div(getValueInPool()));
        uint lpTokenBalance = DAIUSDTQuickswapPool.balanceOf(address(this));
        // uint DAIUSDTQuickLpToken = lpTokenBalance.mul(_amount).div(getValueInPool());
        // uint percentageOfWithdrawl
        uint DAIUSDTQuickLpToken = lpTokenBalance.mul(_amount).div(amountDeposited);
        console.log('DAIUSDTQuickLpTokenOriginal',DAIUSDTQuickLpToken);
        DAIUSDTQuickLpToken = DAIUSDTQuickLpToken > lpTokenBalance ? lpTokenBalance: DAIUSDTQuickLpToken;
        console.log('DAIUSDTQuickLpToken',DAIUSDTQuickLpToken);
        DAIUSDTQuickswapPool.withdraw(DAIUSDTQuickLpToken);
        (_withdrawnDAI, _withdrawnUSDT) = quickSwapRouter.removeLiquidity(address(DAI), address(USDT), DAIUSDTQuickLpToken, 0, 0, address(this), block.timestamp);
    }

    function _withdrawFromCurve(uint _amount) internal returns (uint _withdrawnDAI, uint _withdrawnUSDC, uint _withdrawnUSDT){
        uint lpTokenBalance = rewardGauge.balanceOf(address(this));
        // uint lpTokenToWithdraw = lpTokenBalance.mul(_amount).div(getValueInPool());
        console.log('curve calculations', lpTokenBalance, _amount, amountDeposited);
        uint lpTokenToWithdraw = lpTokenBalance.mul(_amount).div(amountDeposited);
        console.log('withdrawCurve', lpTokenBalance, lpTokenToWithdraw);

        lpTokenToWithdraw = lpTokenToWithdraw > lpTokenBalance ? lpTokenBalance: lpTokenToWithdraw;

        rewardGauge.withdraw(lpTokenToWithdraw);
        uint[3] memory minAMmounts; //
        minAMmounts[0] = 0;
        minAMmounts[1] = 0;
        minAMmounts[2] = 0;

        uint[3] memory withdrawnAmounts = curveFi.remove_liquidity(lpTokenToWithdraw, minAMmounts, true);

        _withdrawnDAI = withdrawnAmounts[0];
        _withdrawnUSDC = withdrawnAmounts[1];
        _withdrawnUSDT = withdrawnAmounts[2];
    }

    function _harvestFromWexPoly() internal {
        uint WexpolyEarned = wexStakingContract.pendingWex(usdtusdcWexPID, address(this));
        
        if(WexpolyEarned > 0 ) {
            wexStakingContract.claim(usdtusdcWexPID);

            address[] memory path = new address[](2);
            path[0] = address(Wexpoly);
            path[1] = address(DAI);

            quickSwapRouter.swapExactTokensForTokens(WexpolyEarned, 0, path, address(this), block.timestamp);
        }        
    }



    function _harvestFromQuick() internal {

        DAIUSDTQuickswapPool.getReward();

        uint quickBalance = QUICK.balanceOf(address(this));
        // quickInPool = quickInPool.add(quickBalance); //check decimals
        if(quickBalance > 0) {
            address[] memory path = new address[](2);
            path[0] = address(QUICK);
            path[1] = address(DAI);

            quickSwapRouter.swapExactTokensForTokens(quickBalance, 0, path, address(this), block.timestamp);
        }

    }

    function _harvestFromCurve() internal {
        rewardGauge.claim_rewards(); 

        address[] memory path = new address[](2);
        path[1] = address(DAI);

        if(MATIC.balanceOf(address(this)) > 0) {
            path[0] = address(MATIC);    
            quickSwapRouter.swapExactTokensForTokens(MATIC.balanceOf(address(this)), 0, path, address(this), block.timestamp);
        }

        if(CRV.balanceOf(address(this)) > 0) {
            path[0] = address(CRV);
            quickSwapRouter.swapExactTokensForTokens(CRV.balanceOf(address(this)), 0, path, address(this), block.timestamp);
        }
        
    }

    function _swapToDepositTokens(uint _amount, IERC20 _token) internal {
        if(_token == USDT) {
            //convert 27.77% to DAI and 27.77% to USDC
            uint amountToSwap = _amount.mul(2777).div(10000);
            curveFi.exchange_underlying(curveIds[_token], curveIds[DAI], amountToSwap, 0);
            curveFi.exchange_underlying(curveIds[_token], curveIds[USDC], amountToSwap, 0);
        }else  {
            //convert 44.44% to USDT
            //27.77% to DAI || USDC depending on the deposit token
            uint amountToUSDT = _amount.mul(4444).div(10000);

            IERC20 _tokenToGet = _token == DAI ? USDC : DAI; //return USDC if sourceToken is DAI, else return DAI.
            console.log('usdcBalance', USDC.balanceOf(address(this)), amountToUSDT);
            curveFi.exchange_underlying(curveIds[_token], curveIds[USDT], amountToUSDT, 0);
            curveFi.exchange_underlying(curveIds[_token], curveIds[_tokenToGet], _amount.mul(2777).div(10000), 0);
        }
    }

    function _depositToWexPoly(uint _usdtAmount, uint _usdcAmount) internal returns (uint usdt_usdcpoolToken){
        usdcInPool = usdcInPool.add(_usdcAmount.mul(1e12));
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));

        (,, usdt_usdcpoolToken) = WexPolyRouter.addLiquidity(address(USDC), address(USDT), _usdcAmount, _usdtAmount, 0, 0, address(this), block.timestamp);
        console.log('usdt_usdcpoolToken',usdt_usdcpoolToken);
        wexStakingContract.deposit(usdtusdcWexPID, usdt_usdcpoolToken, false);
        //deposit to wexPoly
    }

    function _depositToquickSwap(uint _daiAmount, uint _usdtAmount) internal returns(uint dai_usdtpoolToken){
        daiInPool = daiInPool.add(_daiAmount);
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));
        
        (,, dai_usdtpoolToken) = quickSwapRouter.addLiquidity(address(DAI), address(USDT), _daiAmount, _usdtAmount, 0, 0, address(this), block.timestamp);
        console.log('dai_usdtpoolToken',dai_usdtpoolToken);
        DAIUSDTQuickswapPool.stake(dai_usdtpoolToken);
    }


    function _depositToCurve(uint _daiAmount, uint _usdcAmount, uint _usdtAmount) internal returns (uint lpTokenAmount){


        uint[3] memory amounts;
        amounts[0] = _daiAmount;
        amounts[1] = _usdcAmount;
        amounts[2] = _usdtAmount;
        console.log('Add Liquidity to Curve');
        console.log(_daiAmount, _usdcAmount, _usdtAmount);
        console.log(DAI.balanceOf(address(this)), USDC.balanceOf(address(this)), USDT.balanceOf(address(this)));
        
        uint daiBalance = DAI.balanceOf(address(this));
        uint usdcBalance = USDC.balanceOf(address(this));
        uint usdtBalance = USDT.balanceOf(address(this));

        _daiAmount = _daiAmount > daiBalance ? daiBalance : _daiAmount;
        _usdcAmount = _usdcAmount > usdcBalance ? usdcBalance : _usdcAmount;
        _usdtAmount = _usdtAmount > usdtBalance ? usdtBalance : _usdtAmount;

        curveFi.add_liquidity([_daiAmount, _usdcAmount, _usdtAmount], 0, true);
        console.log('curve lpTokenBalance', curveLpToken.balanceOf(address(this)));
        //deposit to gauge
        lpTokenAmount = curveLpToken.balanceOf(address(this));
        rewardGauge.deposit(lpTokenAmount);

        daiInPool = daiInPool.add(_daiAmount);
        usdcInPool = usdcInPool.add(_usdcAmount.mul(1e12));
        usdtInPool = usdtInPool.add(_usdtAmount.mul(1e12));
        
    }

    function setVault(address _vault) external onlyOwner{
        console.log('vault', vault);
        require(vault == address(0), "Cannot set vault");
        vault = _vault;
    }


    function setTreasuryWallet(address _treasury)external onlyVault{
        treasury = _treasury;
    }

    function getValueInPool() public view returns (uint) {
        return daiInPool.add(usdcInPool.add(usdtInPool));
    }
}