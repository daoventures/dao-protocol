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

contract TAstrategy is Ownable { 
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    Vault public vault;
    
    address public treasury;
    address public communityWallet;
    address public strategist;
    
    
    IERC20 public constant DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 public constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 public constant USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 public constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 public constant SUSHI = IERC20(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2);
    IERC20 public constant WBTC = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);

    IUniswapV2Router02 public constant SushiRouter = IUniswapV2Router02(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    IMasterChef public constant MasterChef = IMasterChef(0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd); 

    IUniswapV2Pair public constant WETHWBTCPair = IUniswapV2Pair(0xCEfF51756c56CeFFCA006cD410B03FFC46dd3a58);
    IUniswapV2Pair public constant WETHUSDCPair = IUniswapV2Pair(0x397FF1542f962076d0BFE58eA045FfA2d347ACa0);

    uint private lpTokenBalance;
    uint private WETHWBTCPoolId = 21;
    uint private WETHUSDCPoolId = 1;
    bool public isEmergency = false;
    uint yieldFee = 20; //20%
    uint valueInETH;

    enum Mode {
        attack,
        defend
    }

    Mode public mode;

    constructor(address _treasury, address _communityWallet, address _strategist, Mode _mode) {
        DAI.safeApprove(address(SushiRouter), type(uint).max);
        USDC.safeApprove(address(SushiRouter), type(uint).max);
        USDT.safeApprove(address(SushiRouter), type(uint).max);
        SUSHI.safeApprove(address(SushiRouter), type(uint).max);
        WETH.safeApprove(address(SushiRouter), type(uint).max);
        WBTC.safeApprove(address(SushiRouter), type(uint).max);

        WETHWBTCPair.approve(address(MasterChef), type(uint).max);
        WETHUSDCPair.approve(address(MasterChef), type(uint).max);

        WETHWBTCPair.approve(address(SushiRouter), type(uint).max);
        WETHUSDCPair.approve(address(SushiRouter), type(uint).max);

        treasury = _treasury;
        communityWallet = _communityWallet;
        strategist = _strategist;
        mode = _mode;
    }

    modifier onlyVault {
        require(msg.sender == address(vault), "Only Vault");
        _;
    }
    ///@param _amount amount in WETH
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
            WETH.safeTransfer(address(vault), _amount);
        }

    }

    function migrateFunds() external onlyVault {
        _yield();
        if(lpTokenBalance > 0) {
            address[] memory path = new address[](2);
            uint[] memory amounts;

            if(mode == Mode.attack) {
                MasterChef.withdraw(WETHWBTCPoolId, lpTokenBalance);
                path[0] = address(WBTC);
                path[1] = address(WETH);

                (, uint wBTCAmount) = SushiRouter.removeLiquidity(address(WETH), address(WBTC), lpTokenBalance, 0, 0, address(this), block.timestamp);

                amounts = SushiRouter.swapExactTokensForTokens(wBTCAmount, 0, path, address(this), block.timestamp);           
                lpTokenBalance = 0;

            }

            if(mode == Mode.defend) {
                MasterChef.withdraw(WETHUSDCPoolId, lpTokenBalance);
                path[0] = address(USDC);
                path[1] = address(WETH);

                (,uint usdcAmount) = SushiRouter.removeLiquidity(address(WETH), address(USDC), lpTokenBalance, 0, 0, address(this), block.timestamp);

                amounts = SushiRouter.swapExactTokensForTokens(usdcAmount, 0, path, address(this), block.timestamp);
                lpTokenBalance = 0;

            }
        }
    }

    function emergencyWithdraw() external onlyVault {
        isEmergency = true;
        //withdraw from masterchef
        //remove liquidity from sushiswap
        //convert to ETH and set value in ValueInETH variable
        if(lpTokenBalance > 0) {
            address[] memory path = new address[](2);
            uint[] memory amounts;

            if(mode == Mode.attack) {
                MasterChef.withdraw(WETHWBTCPoolId, lpTokenBalance);
                path[0] = address(WBTC);
                path[1] = address(WETH);

                (uint ethRemoved, uint wBTCAmount) = SushiRouter.removeLiquidity(address(WETH), address(WBTC), lpTokenBalance, 0, 0, address(this), block.timestamp);

                amounts = SushiRouter.swapExactTokensForTokens(wBTCAmount, 0, path, address(this), block.timestamp);           
                lpTokenBalance = 0;
                valueInETH = ethRemoved.add(amounts[1]);

            }

            if(mode == Mode.defend) {
                MasterChef.withdraw(WETHUSDCPoolId, lpTokenBalance);
                path[0] = address(USDC);
                path[1] = address(WETH);

                (uint ethRemoved,uint usdcAmount) = SushiRouter.removeLiquidity(address(WETH), address(USDC), lpTokenBalance, 0, 0, address(this), block.timestamp);

                amounts = SushiRouter.swapExactTokensForTokens(usdcAmount, 0, path, address(this), block.timestamp);
                lpTokenBalance = 0;
                valueInETH = ethRemoved.add(amounts[1]);

            }
        }


        
    }

    /**
        @notice Called after emergencyWithdraw. This function reinvests the amounts back to the same strategy
     */
    function reinvest() external onlyVault {
        isEmergency = false;        
        if(valueInETH > 0) {
            _invest(valueInETH);
            valueInETH = 0;
        }
    }

    function setYieldFee(uint _yieldFee) external onlyVault {
        yieldFee = _yieldFee;
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
        //convert 50% to USDC/WBTC based on the current mode
        //Deposit to WETH/WBTC during attack mode
        //Deposit to WETH/USDC during defend mode
        address[] memory path = new address[](2);
        path[0] = address(WETH);

        if(mode == Mode.attack) {           
            path[1] = address(WBTC);
            uint[] memory amountsBtc = SushiRouter.swapExactTokensForTokens(_amountDivided, 0, path, address(this), block.timestamp);

            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(WBTC), _amountDivided, amountsBtc[1], 0, 0, address(this), block.timestamp);
            MasterChef.deposit(WETHWBTCPoolId, liquidity);
            lpTokenBalance = lpTokenBalance.add(liquidity);
        }

        if(mode == Mode.defend) {
            path[1] = address(USDC);

            uint[] memory amountsUSDC = SushiRouter.swapExactTokensForTokens(_amountDivided, 0, path, address(this), block.timestamp);       
            
            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(USDC), _amountDivided, amountsUSDC[1], 0, 0, address(this), block.timestamp);
            MasterChef.deposit(WETHUSDCPoolId, liquidity);
            lpTokenBalance = lpTokenBalance.add(liquidity);
        }
    }

    function switchMode(Mode _newMode) external onlyVault{
        require(_newMode != mode, "Cannot switch to same mode");

        //withdraw from current pools
        //Deposit to new pools based on the mode
        address[] memory path = new address[](3);
        
        if(_newMode == Mode.attack) {
            path[0] = address(USDC);
            path[1] = address(WETH);
            path[2] = address(WBTC);
            // remove from lp pool
            MasterChef.withdraw(WETHUSDCPoolId, lpTokenBalance);

            (uint ethAmount, uint usdcAmount) = SushiRouter.removeLiquidity(address(WETH), address(USDC), lpTokenBalance, 0, 0, address(this), block.timestamp);
            
            uint[] memory amounts = SushiRouter.swapExactTokensForTokens(usdcAmount, 0, path, address(this), block.timestamp);

            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(WBTC), ethAmount, amounts[2], 0, 0, address(this), block.timestamp);
            //add to masterchef
            MasterChef.deposit(WETHWBTCPoolId, liquidity);
            lpTokenBalance = liquidity;

        } else if(_newMode == Mode.defend){
            
            path[0] = address(WBTC);
            path[1] = address(WETH);
            path[2] = address(USDC);
            // remove from lp pool
            MasterChef.withdraw(WETHWBTCPoolId, lpTokenBalance);

            (uint ethAmount, uint wbtcAmount) = SushiRouter.removeLiquidity(address(WETH), address(WBTC), lpTokenBalance, 0, 0, address(this), block.timestamp);
            
            uint[] memory amounts = SushiRouter.swapExactTokensForTokens(wbtcAmount, 0, path, address(this), block.timestamp);
            
            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(USDC), ethAmount, amounts[2], 0, 0, address(this), block.timestamp);
            //add to pool
            MasterChef.deposit(WETHUSDCPoolId, liquidity);
            lpTokenBalance = liquidity;
        }

        mode = _newMode;
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
        uint pid = mode == Mode.attack ? WETHWBTCPoolId : WETHUSDCPoolId;

        (uint _amountDeposited, ) = MasterChef.userInfo(pid, address(this));

        if(_amountDeposited > 0) {
    
            uint sushiBalance = SUSHI.balanceOf(address(this));
            

            if(sushiBalance > 0) {
                uint fee = sushiBalance.mul(yieldFee).div(10000); 
                uint _treasuryFee = fee.mul(2).div(5); //40%
                SUSHI.safeTransfer(treasury, _treasuryFee);
                SUSHI.safeTransfer(communityWallet, _treasuryFee);
                SUSHI.safeTransfer(strategist, fee.sub(_treasuryFee).sub(_treasuryFee));

                address[] memory path = new address[](2);
                path[0] = address(SUSHI);
                path[1] = address(WETH);
                SushiRouter.swapExactTokensForTokens(sushiBalance.sub(fee), 0, path, address(this), block.timestamp);
                
                _invest(WETH.balanceOf(address(this)));
            }
        }

    }

    ///@param _amount amount in WETH
    function _withdraw(uint _amount) internal {
        (uint valueInPoolInETH, ) = getValueInPool();
        uint amountToRemove = lpTokenBalance.mul(_amount).div(valueInPoolInETH);
        
        address[] memory path = new address[](2);
        uint[] memory amounts;

        //convert WBTC or USDC to WETH and withdraw to vault

        if(mode == Mode.attack) {
            MasterChef.withdraw(WETHWBTCPoolId, amountToRemove);
            path[0] = address(WBTC);
            path[1] = address(WETH);
            

            (, uint wBTCAmount) = SushiRouter.removeLiquidity(address(WETH), address(WBTC), amountToRemove, 0, 0, address(this), block.timestamp);
            

            amounts = SushiRouter.swapExactTokensForTokens(wBTCAmount, 0, path, address(this), block.timestamp);

        }
        
        if(mode == Mode.defend) {
            MasterChef.withdraw(WETHUSDCPoolId, amountToRemove);
            path[0] = address(USDC);
            path[1] = address(WETH);

            (, uint usdcAmount) = SushiRouter.removeLiquidity(address(WETH), address(USDC), amountToRemove, 0, 0, address(this), block.timestamp);
            amounts = SushiRouter.swapExactTokensForTokens(usdcAmount, 0, path, address(this), block.timestamp);


        }

        lpTokenBalance = lpTokenBalance.sub(amountToRemove);
    }

    function setVault(address _vault) external onlyOwner {
        require(address(vault) == address(0), "Cannot set vault");
        vault = Vault(_vault);
        WETH.safeApprove(_vault, type(uint).max);
    }

    /// @notice Returns the value in pool in terms of ETH and USDC
    /// @dev Calculates the amount of ETH and `token`(USDC or WBTC) for the lpToken. Get price of `token` in ETH
    function getValueInPool() public view returns (uint _valueInETH, uint _valueInUSDC) {

        if(isEmergency == false ) {
            if(lpTokenBalance == 0) {
                return (0,0);
            }

            IUniswapV2Pair pair = mode == Mode.attack ? WETHWBTCPair: WETHUSDCPair;

            (uint reserve0, uint reserve1,) = pair.getReserves();
            uint totalLpTokenSupply = pair.totalSupply();

            uint amountA = lpTokenBalance.mul(reserve0).div(totalLpTokenSupply); //reserve0 is either WBTC or USDC
            uint amountETH = lpTokenBalance.mul(reserve1).div(totalLpTokenSupply);

            address[] memory path = new address[](2);
            path[0] = pair.token0();//WBTC or USDC
            path[1] = address(WETH);

            uint[] memory amounts = SushiRouter.getAmountsOut(amountA, path);

            _valueInETH = amounts[1].add(amountETH);

            path[0] = address(WETH);
            path[1] = address(USDC);
            amounts = SushiRouter.getAmountsOut(_valueInETH, path);

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
