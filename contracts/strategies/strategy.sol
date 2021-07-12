// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IUniswapV2Router02.sol";
import "../../interfaces/IMasterChef.sol";
import "../../interfaces/IUniswapV2Pair.sol";

interface Vault {
    function getReimburseTokenAmount(uint) external view returns (uint);
}

contract strategy is Ownable { //TODO rename contract
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    Vault public vault;
    
    address public treasury;
    address public communityWallet;
    address public strategist;
    
    
    IERC20 public DAI;
    IERC20 public USDC;
    IERC20 public USDT;
    IERC20 public constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 public SUSHI;
    IERC20 public constant WBTC = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);

    IUniswapV2Router02 public constant SushiRouter = IUniswapV2Router02(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    IMasterChef public constant MasterChef = IMasterChef(0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd); //TODO update PID

    IUniswapV2Pair public constant WETHWBTCPair = IUniswapV2Pair(0xCEfF51756c56CeFFCA006cD410B03FFC46dd3a58);
    IUniswapV2Pair public constant WETHUSDCPair = IUniswapV2Pair(0x397FF1542f962076d0BFE58eA045FfA2d347ACa0);

    uint private lpTokenBalance;
    bool public isEmergency = false;
    uint valueInETH;

    enum Mode {
        attack,
        defend
    }

    Mode public mode;

    constructor(address _treasury) {
        DAI.safeApprove(address(SushiRouter), type(uint).max);
        USDC.safeApprove(address(SushiRouter), type(uint).max);
        USDT.safeApprove(address(SushiRouter), type(uint).max);
        SUSHI.safeApprove(address(SushiRouter), type(uint).max);
        WETH.safeApprove(address(SushiRouter), type(uint).max);
        WBTC.safeApprove(address(SushiRouter), type(uint).max);

        WETHWBTCPair.approve(address(MasterChef), type(uint).max);
        WETHUSDCPair.approve(address(MasterChef), type(uint).max);

        treasury = _treasury;
    }

    modifier onlyVault {
        require(msg.sender == address(vault), "Only Vault");
        _;
    }

    function invest(uint _amount) external onlyVault {
        require(_amount > 0, "Invalid Amount");
        
        WETH.safeTransferFrom(address(vault), address(this), _amount);
        _invest(_amount);
    }

    function withdraw(uint _amount) external onlyVault {
        require(_amount > 0, "Invalid Amount");

        if(isEmergency == false ) {
            _withdraw(_amount);
            WETH.safeTransfer(address(vault), WETH.balanceOf(address(this)));
        } else {
            valueInETH = valueInETH.sub(_amount);
            WETH.safeTransfer(address(vault), valueInETH);
        }
        
        

    }

    function emergencyWithdraw() external onlyVault {
        isEmergency = true;

        address[] memory path = new address[](2);
        uint[] memory amounts;

        if(mode == Mode.attack) {
            MasterChef.withdraw(0, lpTokenBalance);
            path[0] = address(WBTC);
            path[1] = address(WETH);
            

            (uint ethRemoved, uint wBTCAmount) = SushiRouter.removeLiquidity(address(WETH), address(WBTC), lpTokenBalance, 0, 0, address(this), block.timestamp);
            
            amounts = SushiRouter.swapExactTokensForTokens(wBTCAmount, 0, path, address(this), block.timestamp);           
            lpTokenBalance = 0;
            valueInETH = ethRemoved.add(amounts[1]);

        }
        
        if(mode == Mode.defend) {
            MasterChef.withdraw(0, lpTokenBalance);
            path[0] = address(USDC);
            path[1] = address(WETH);

            (uint ethRemoved,uint usdcAmount) = SushiRouter.removeLiquidity(address(WETH), address(USDC), lpTokenBalance, 0, 0, address(this), block.timestamp);
            
            amounts = SushiRouter.swapExactTokensForTokens(usdcAmount, 0, path, address(this), block.timestamp);
            lpTokenBalance = 0;
            valueInETH = ethRemoved.add(amounts[1]);

        }

        // WETH.safeTransfer(vault, WETH.balanceOf(address(this)));
    }

    function reInvest() external onlyVault {
        isEmergency = false;        
        
        _invest(valueInETH);
        valueInETH = 0;
    }

    function migrateFunds() external onlyVault {
        _yield();
        (, uint _valueInPool) = getValueInPool();

        _withdraw(_valueInPool);

        WETH.safeTransfer(address(vault), WETH.balanceOf(address(this)));
    }

    function reimburse() external onlyVault {
        uint256 _reimburseUSDT = vault.getReimburseTokenAmount(0);
        uint256 _reimburseUSDC = vault.getReimburseTokenAmount(1);
        uint256 _reimburseDAI = vault.getReimburseTokenAmount(2);
        uint256 _totalReimburse = _reimburseUSDT.add(_reimburseUSDC).add(_reimburseDAI.div(1e12));

        address[] memory path = new address[](2);
        path[0] = address(USDT);
        path[1] = address(WETH);
        uint256[] memory _amounts = SushiRouter.getAmountsOut(_totalReimburse, path);
        if (WETH.balanceOf(address(this)) < _amounts[1]) { 
            
            uint256 _thirtyPercOfAmtWithdraw = _amounts[1].mul(3000).div(10000);
            _withdraw(_thirtyPercOfAmtWithdraw);                   
        }

        // Swap WETH to token and transfer back to vault
        uint256 _WETHBalance = WETH.balanceOf(address(this));
        _reimburse(_WETHBalance.mul(_reimburseUSDT).div(_totalReimburse), USDT);
        _reimburse(_WETHBalance.mul(_reimburseUSDC).div(_totalReimburse), USDC);
        _reimburse((WETH.balanceOf(address(this))), DAI);
    }



    function _reimburse(uint256 _reimburseAmt, IERC20 _token) private {
        if (_reimburseAmt > 0) {
            address[] memory path = new address[](2);
            path[0] = address(WETH);
            path[1] = address(_token);
            uint256[] memory _amounts = SushiRouter.swapExactTokensForTokens(_reimburseAmt, 0, path, address(this), block.timestamp);
            _token.safeTransfer(address(vault), _amounts[1]);
        }
    }

    function _invest(uint _amount) internal {
        uint _amountDivided = _amount.div(2) ; //50%

        address[] memory path = new address[](2);
        path[0] = address(WETH);

        if(mode == Mode.attack) {           
            path[1] = address(WBTC);
            uint[] memory amountsBtc = SushiRouter.swapExactTokensForTokens(_amountDivided, 0, path, address(this), block.timestamp);

            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(WBTC), _amountDivided, amountsBtc[1], 0, 0, address(this), block.timestamp);
            MasterChef.deposit(0, liquidity);
            lpTokenBalance = lpTokenBalance.add(liquidity);
        }

        if(mode == Mode.defend) {
            path[1] = address(USDC);

            uint[] memory amountsUSDC = SushiRouter.swapExactTokensForTokens(_amountDivided, 0, path, address(this), block.timestamp);       
            
            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(USDC), _amountDivided, amountsUSDC[1], 0, 0, address(this), block.timestamp);
            MasterChef.deposit(0, liquidity);
            lpTokenBalance = lpTokenBalance.add(liquidity);
        }
    }

    function switchMode(Mode _newMode) external onlyVault{
        require(_newMode != mode, "Cannot switch to same mode");

        address[] memory path = new address[](2);
        
        if(_newMode == Mode.attack) {
            path[0] = address(USDC);
            path[1] = address(WBTC);
            // remove from lp pool
            MasterChef.withdraw(0, lpTokenBalance);

            (uint ethAmount, uint usdcAmount) = SushiRouter.removeLiquidity(address(WETH), address(USDC), lpTokenBalance, 0, 0, address(this), block.timestamp);
            
            uint[] memory amounts = SushiRouter.swapExactTokensForTokens(usdcAmount, 0, path, address(this), block.timestamp);

            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(WBTC), ethAmount, amounts[1], 0, 0, address(this), block.timestamp);
            //add to masterchef
            MasterChef.deposit(0, liquidity);
            lpTokenBalance = liquidity;

        } else if(_newMode == Mode.defend){
            path[0] = address(WBTC);
            path[1] = address(USDC);
            // remove from lp pool
            MasterChef.withdraw(0, lpTokenBalance);

            (uint ethAmount, uint wbtcAmount) = SushiRouter.removeLiquidity(address(WETH), address(WBTC), lpTokenBalance, 0, 0, address(this), block.timestamp);
            uint[] memory amounts = SushiRouter.swapExactTokensForTokens(wbtcAmount, 0, path, address(this), block.timestamp);

            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(USDC), ethAmount, amounts[1], 0, 0, address(this), block.timestamp);
            //add to pool
            MasterChef.deposit(0, liquidity);
            lpTokenBalance = liquidity;
        }
    }

    function yield() external onlyVault {
        _yield();
    }

    function setStrategist(address _strategist) external onlyVault {
        strategist = _strategist;
    }

    function setCommunityWallet(address _communityWallet) external onlyVault {
        communityWallet = _communityWallet;
    }

    function setTreasuryWallet(address _treasuryWallet) external onlyVault {
        treasury = _treasuryWallet;
    }

    function _yield() internal {
        //withdraw lpTokens from masterChef
        //deposit to masterChef
        //if SUHSI balance > 0 , swap and _invest base on MODE
        uint pid = mode == Mode.attack ? 0 : 0;

        (,uint rewardDebt) = MasterChef.userInfo(0, address(this));

        if(rewardDebt > 0) {
            MasterChef.withdraw(pid, lpTokenBalance);
            uint sushiBalance = SUSHI.balanceOf(address(this));
            MasterChef.deposit(pid, lpTokenBalance);

            if(sushiBalance > 0) {
                uint fee = sushiBalance.div(10); //10 %
                uint _treasuryFee = fee.mul(2).div(5); //40%
                SUSHI.safeTransfer(treasury, _treasuryFee);
                SUSHI.safeTransfer(communityWallet, _treasuryFee);
                SUSHI.safeTransfer(strategist, fee.sub(_treasuryFee).sub(_treasuryFee));

                address[] memory path = new address[](2);
                SushiRouter.swapExactTokensForTokens(sushiBalance.sub(fee), 0, path, address(this), block.timestamp);
                _invest(WETH.balanceOf(address(this)));
            }
        }

    }

    function _withdraw(uint _amount) internal {
        (uint valueInPoolInETH, ) = getValueInPool();
        uint amountToRemove = lpTokenBalance.mul(_amount).div(valueInPoolInETH);
        
        address[] memory path = new address[](2);
        uint[] memory amounts;

        if(mode == Mode.attack) {
            MasterChef.withdraw(0, amountToRemove);
            path[0] = address(WBTC);
            path[1] = address(WETH);
            

            (, uint wBTCAmount) = SushiRouter.removeLiquidity(address(WETH), address(WBTC), amountToRemove, 0, 0, address(this), block.timestamp);
            
            //convert second to eth
            //convert eth to require token

            amounts = SushiRouter.swapExactTokensForTokens(wBTCAmount, 0, path, address(this), block.timestamp);

            /* path[0] = address(WETH);
            path[1] = address(_token);
            SushiRouter.swapExactTokensForTokens(amounts[1].add(ethAmount), 0, path, address(this), block.timestamp);
 */
        }
        
        if(mode == Mode.defend) {
            MasterChef.withdraw(0, amountToRemove);
            path[0] = address(USDC);
            path[1] = address(WETH);

            (, uint usdcAmount) = SushiRouter.removeLiquidity(address(WETH), address(USDC), amountToRemove, 0, 0, address(this), block.timestamp);
            amounts = SushiRouter.swapExactTokensForTokens(usdcAmount, 0, path, address(this), block.timestamp);
/*             if(_token != USDC) {
                // convert usdc to eth
                // convert eth to _token
                amounts = SushiRouter.swapExactTokensForTokens(usdcAmount, 0, path, address(this), block.timestamp);

                path[0] = address(WETH);
                path[1] = address(_token);

                SushiRouter.swapExactTokensForTokens(amounts[1].add(ethAmount), 0, path, address(this), block.timestamp);
            } else { //_token == sudc
                //convert eth to usdc
                path[0] = address(WETH);
                path[1] = address(USDC);
                amounts = SushiRouter.swapExactTokensForTokens(ethAmount, 0, path, address(this), block.timestamp);
            } */

        }

        lpTokenBalance = lpTokenBalance.sub(amountToRemove);
    }

    function setVault(address _vault) external onlyOwner {
        require(address(vault) == address(0), "Cannot set vault");
        vault = Vault(_vault);
    }

   
    function getValueInPool() public view returns (uint _valueInETH, uint _valueInUSDC) {

        if(isEmergency == false ) {
            IUniswapV2Pair pair = mode == Mode.attack ? WETHWBTCPair: WETHUSDCPair;

            (uint reserve0, uint reserve1,) = pair.getReserves();
            uint totalLpTokenSupply = pair.totalSupply();

            uint amountA = lpTokenBalance.mul(reserve0).div(totalLpTokenSupply); //reserve0 is either WBTC or USDC
            uint amountETH = lpTokenBalance.mul(reserve1).div(totalLpTokenSupply);

            address[] memory path = new address[](2);
            path[0] = pair.token0();
            path[1] = address(WETH);

            uint[] memory amounts = SushiRouter.getAmountsOut(amountA, path);

            _valueInETH = amounts[1].add(amountETH);

            path[0] = address(WETH);
            path[1] = address(USDC);
            amounts = SushiRouter.getAmountsOut(amountA, path);

            _valueInUSDC = amounts[1];
        } else {
            _valueInETH = valueInETH;

            address[] memory path = new address[](2);
            path[0] = address(WETH);
            path[1] = address(USDC);
            uint[] memory amounts = SushiRouter.getAmountsOut(valueInETH, path);

            _valueInUSDC = amounts[1];
        }

    }


}
