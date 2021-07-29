// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

interface sushiRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
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

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);
}

interface IYvBOOST is IERC20 {
    function deposit(uint) external;
    function withdraw(uint) external;
}

interface IPickleJar is IERC20 {
    function deposit(uint) external;
    function withdraw(uint) external;
}

interface IPickleFarm {
    function deposit(uint) external;
    function withdraw(uint) external;
    function getReward() external;
    function balanceOf(address) external view returns (uint);
}

contract YearnStrategy is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IYvBOOST;
    using SafeERC20 for IPickleJar;
    using SafeMath for uint256;

    IERC20 USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7); // 6 decimals
    IERC20 WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // 18 decimals
    IERC20 yveCRV = IERC20(0xc5bDdf9843308380375a611c18B50Fb9341f502A); // 18 decimals
    sushiRouter sRouter = sushiRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    IERC20 SLP = IERC20(0x9461173740D27311b176476FA27e94C681b1Ea6b); // 18 decimals
    IYvBOOST yvBOOST = IYvBOOST(0x9d409a0A012CFbA9B15F6D4B36Ac57A46966Ab9a); // 18 decimals
    IPickleJar pJar = IPickleJar(0xCeD67a187b923F0E5ebcc77C7f2F7da20099e378); // 18 decimals
    IPickleFarm pFarm = IPickleFarm(0xDA481b277dCe305B97F4091bD66595d57CF31634);
    IERC20 PICKLE = IERC20(0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5); // 18 decimals
    IERC20 SUSHI = IERC20(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2);

    constructor() ERC20("Yearn yvBOOST Strategy", "YYS") {
        USDT.safeApprove(address(sRouter), type(uint).max);
        WETH.safeApprove(address(sRouter), type(uint).max);
        yvBOOST.safeApprove(address(sRouter), type(uint).max);
        yveCRV.safeApprove(address(yvBOOST), type(uint).max);
        SLP.safeApprove(address(pJar), type(uint).max);
        SLP.safeApprove(address(sRouter), type(uint).max);
        pJar.safeApprove(address(pFarm), type(uint).max);
    }

    function invest() external {
        address[] memory _path2 = new address[](2);
        _path2[0] = address(USDT);
        _path2[1] = address(WETH);
        sRouter.swapExactTokensForTokens(USDT.balanceOf(address(this)), 0, _path2, address(this), block.timestamp);

        address[] memory _path = new address[](2);
        _path[0] = address(WETH);
        _path[1] = address(yvBOOST);
        sRouter.swapExactTokensForTokens(WETH.balanceOf(address(this)).div(2), 0, _path, address(this), block.timestamp);
        (uint a, uint b, uint liquidity) = sRouter.addLiquidity(address(yvBOOST), address(WETH), yvBOOST.balanceOf(address(this)), WETH.balanceOf(address(this)), 0, 0, address(this), block.timestamp);
        // console.log(a); // 322.577581628416194237
        // console.log(b); // 0.220927350563858899
        // console.log(liquidity); // 8.340944919607337232
        // console.log(SLP.balanceOf(address(this))); // 8355681272589355348
        // console.log(yvBOOST.balanceOf(address(this)));
        // console.log(WETH.balanceOf(address(this))); // 0.000655150733786129

        pJar.deposit(SLP.balanceOf(address(this)));
        // console.log(pJar.balanceOf(address(this))); // 7.074150088004257977

        pFarm.deposit(pJar.balanceOf(address(this)));
        // console.log(SUSHI.balanceOf(address(this)));

        _mint(msg.sender, _shares);
    }

    function yield() external {
        pFarm.getReward();
        // console.log(PICKLE.balanceOf(address(this))); // 0.000001976203030268
        // console.log(SUSHI.balanceOf(address(this)));
    }

    function withdraw() external {
        pFarm.withdraw(pFarm.balanceOf(address(this)));
        pJar.withdraw(pJar.balanceOf(address(this)));
        console.log(SLP.balanceOf(address(this))); // 8797576155164358897
        // sRouter.removeLiquidity(address(yvBOOST), address(WETH), SLP.balanceOf(address(this)), 0, 0, address(this), block.timestamp);
        // console.log(yvBOOST.balanceOf(address(this)));
        // console.log(WETH.balanceOf(address(this)));
        // console.log(SUSHI.balanceOf(address(this)));

        _burn(msg.sender, _shares);
    }
}