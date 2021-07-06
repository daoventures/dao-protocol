// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IUniswapV2Router02.sol";
import "../../interfaces/IMasterChef.sol";
import "../../interfaces/IUniswapV2Pair.sol";

contract strategy is Ownable { //TODO rename contract
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    address vault;
    
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

    enum Mode {
        attack,
        defend
    }

    Mode public mode;

    constructor() {
        DAI.approve(address(SushiRouter), type(uint).max);
        USDC.approve(address(SushiRouter), type(uint).max);
        USDT.approve(address(SushiRouter), type(uint).max);
        SUSHI.approve(address(SushiRouter), type(uint).max);
        WETH.approve(address(SushiRouter), type(uint).max);
        WBTC.approve(address(SushiRouter), type(uint).max);

        //approve lp tokens on masterchef, router
    }

    modifier onlyVault {
        require(msg.sender == vault, "Only Vault");
        _;
    }

    function _invest(uint _amount, IERC20 _token) internal {
        uint _amountDivided = _token == DAI || _token == SUSHI ? _amount.div(2) : _amount.div(2).div(1e12); //50%

        address[] memory path = new address[](2);
        path[0] = address(_token);

        if(mode == Mode.attack) {
            path[1] = address(WETH);
            uint[] memory amountsEth = SushiRouter.swapExactTokensForTokens(_amountDivided, 0, path, address(this), block.timestamp);
            
            path[1] = address(WBTC);
            uint[] memory amountsBtc = SushiRouter.swapExactTokensForTokens(_amountDivided, 0, path, address(this), block.timestamp);

            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(WBTC), amountsEth[1], amountsBtc[1], 0, 0, address(this), block.timestamp);
            MasterChef.deposit(0, liquidity);
            lpTokenBalance = lpTokenBalance.add(liquidity);
        }

        if(mode == Mode.defend) {
            path[1] = address(WETH);

            uint[] memory amountsUSDC;
            uint[] memory amountsEth = SushiRouter.swapExactTokensForTokens(_amountDivided, 0, path, address(this), block.timestamp);
            
            if(_token != USDC) {
                path[1] = address(USDC);
                amountsUSDC = SushiRouter.swapExactTokensForTokens(_amountDivided, 0, path, address(this), block.timestamp);    
            }

            (,,uint liquidity) = SushiRouter.addLiquidity(address(WETH), address(USDC), amountsEth[1], _token == USDC ? _amountDivided : amountsUSDC[1], 0, 0, address(this), block.timestamp);
            MasterChef.deposit(0, liquidity);
            lpTokenBalance = lpTokenBalance.add(liquidity);
        }
    }

    function switchMode(Mode _newMode) internal{
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

    function yield() external onlyVault{
        //withdraw lpTokens from masterChef
        //deposit to masterChef
        //if SUHSI balance > 0 , swap and _invest base on MODE
        uint pid = mode == Mode.attack ? 0 : 0;

        MasterChef.withdraw(pid, lpTokenBalance);
        uint sushiBalance = SUSHI.balanceOf(address(this));
        MasterChef.deposit(pid, lpTokenBalance);
        if(sushiBalance > 0) {
            _invest(sushiBalance, SUSHI);
        }

    }

    function _withdraw(uint _amount, IERC20 _token) internal {
        (,uint valueInPool) = getValueInPool();
        uint amountToRemove = lpTokenBalance.mul(_amount).div(valueInPool);
        
        address[] memory path = new address[](2);
        uint[] memory amounts;

        if(mode == Mode.attack) {
            MasterChef.withdraw(0, amountToRemove);
            path[0] = address(WBTC);
            path[1] = address(WETH);
            

            (uint ethAmount, uint wBTCAmount) = SushiRouter.removeLiquidity(address(WETH), address(WBTC), amountToRemove, 0, 0, address(this), block.timestamp);
            
            //convert second to eth
            //convert eth to require token

            amounts = SushiRouter.swapExactTokensForTokens(wBTCAmount, 0, path, address(this), block.timestamp);

            path[0] = address(WETH);
            path[1] = address(_token);
            SushiRouter.swapExactTokensForTokens(amounts[1].add(ethAmount), 0, path, address(this), block.timestamp);

        }
        
        if(mode == Mode.defend) {
            MasterChef.withdraw(0, amountToRemove);
            path[0] = address(USDC);
            path[1] = address(WETH);

            (uint ethAmount, uint usdcAmount) = SushiRouter.removeLiquidity(address(WETH), address(USDC), amountToRemove, 0, 0, address(this), block.timestamp);

            if(_token != USDC) {
                // convert usdc to eth
                // convert eth to _token
                amounts = SushiRouter.swapExactTokensForTokens(usdcAmount, 0, path, address(this), block.timestamp);

                path[0] = address(WETH);
                path[1] = address(USDC);

                SushiRouter.swapExactTokensForTokens(amounts[1].add(ethAmount), 0, path, address(this), block.timestamp);
            } else { //_token == sudc
                //convert eth to usdc
                path[0] = address(WETH);
                path[1] = address(USDC);
                amounts = SushiRouter.swapExactTokensForTokens(ethAmount, 0, path, address(this), block.timestamp);
            }

        }

        lpTokenBalance = lpTokenBalance.sub(amountToRemove);
    }

    function setVault(address _vault) external onlyOwner {
        require(vault == address(0), "Cannot set vault");
        vault = _vault;
    }

   
    function getValueInPool() public view returns (uint valueInETH, uint valueInUSDC) {
        IUniswapV2Pair pair = mode == Mode.attack ? WETHWBTCPair: WETHUSDCPair;

        (uint reserve0, uint reserve1,) = pair.getReserves();
        uint totalLpTokenSupply = pair.totalSupply();
        
        uint amountA = lpTokenBalance.mul(reserve0).div(totalLpTokenSupply); //reserve0 is either WBTC or USDC
        uint amountETH = lpTokenBalance.mul(reserve1).div(totalLpTokenSupply);

        address[] memory path = new address[](2);
        path[0] = pair.token0();
        path[1] = address(WETH);

        uint[] memory amounts = SushiRouter.getAmountsOut(amountA, path);

        valueInETH = amounts[1].add(amountETH);
        
        path[0] = address(WETH);
        path[1] = address(USDC);
        amounts = SushiRouter.getAmountsOut(amountA, path);

        valueInUSDC = amounts[1];
    }


}
