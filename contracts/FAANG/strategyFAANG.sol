pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../../interfaces/ILPPool.sol";
import "../../interfaces/ICurveFi.sol";

contract FAANGStrategy {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    ICurveFi public curveFi = ICurveFi(0x890f4e345B1dAED0367A877a1612f86A1f86985f); //TODO : Check
    IUniswapV2Router02 public router;

    struct mAsset {
        uint256 weight;
        IERC20 mAssetToken;
        ILPPool lpPool;
        IERC20 lpToken;
        uint amountOfATotal;
        uint amountOfBTotal;
    }
    //address public constant ust = 0xa47c8bf37f92aBed4A126BDA807A7b7498661acD;
    //address public constant mir = 0xa47c8bf37f92aBed4A126BDA807A7b7498661acD;
    IERC20 ust = IERC20(0xa47c8bf37f92aBed4A126BDA807A7b7498661acD);
    IERC20 mir = IERC20(0xa47c8bf37f92aBed4A126BDA807A7b7498661acD);
    
    address public vault;
    address public treasuryWallet;
    ILPPool mirustPool;

    mapping(address => int128) curveIds;
    mapping(address => uint256[]) public userLPToken;
    mapping(IERC20 => uint256) public userTotalLPToken;
    mapping(IERC20 => uint256) public amountInPool;
    mapping(ILPPool => uint256) public poolStakedMIRLPToken;
    mAsset[] public mAssets;

    uint amountDeposited;

    constructor(address _vault, 
        address _treasuryWallet, 
        address _mirustPool,
        uint[] memory weights,
        IERC20[] memory mAssetsTokens,
        ILPPool[] memory lpPools,
        IERC20[] memory lpTokens

        ) {
        vault = _vault;

        //TODO : Check
        curveIds[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = 1;
        curveIds[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 2;
        curveIds[0x6B175474E89094C44Da98b954EedeAC495271d0F] = 0;

        treasuryWallet = _treasuryWallet;
        mirustPool = ILPPool(_mirustPool);
        //TODO: Add approvals

        ust.approve(address(router), type(uint256).max);
        mir.approve(address(router), type(uint256).max);


        for(uint i=0; i<weights.length; i++) {
            mAssets.push(mAsset({
                weight: weights[i],
                mAssetToken : mAssetsTokens[i],
                lpPool:lpPools[i],
                lpToken:lpTokens[i],
                amountOfATotal: 0,
                amountOfBTotal: 0
            }));
        }

    }

    function deposit(uint256 _amount, address _token) external {
        require(msg.sender == vault, "Only Vault can call this function");
        require(_amount > 0);
        amountDeposited = amountDeposited.add(_amount);
        int128 principalCurveId = curveIds[_token];
        uint256 ustAmount = curveFi.exchange(principalCurveId, 0, _amount, 0);

        address[] memory path;
        uint256[] memory amounts;

        for (uint256 i = 0; i < mAssets.length; i++) {
            uint256 weight_ = mAssets[i].weight;
            address addr_ = address(mAssets[i].mAssetToken);

            // UST -> mAsset on Uniswap
            path[0] = address(ust);
            path[1] = addr_;
            uint _ustAmount = ustAmount.mul(weight_).div(10000);
            amounts = router.swapExactTokensForTokens(
                _ustAmount,
                0,
                path,
                address(this),
                block.timestamp
            );

            // addLiquidity: mAsset + UST
            (, , uint256 poolTokenAmount) = router.addLiquidity(addr_,  address(ust), amounts[1], _ustAmount, 0, 0, address(this), block.timestamp);

            // stake LPToken to LPPool
            mAssets[i].lpPool.stake(poolTokenAmount);

            userLPToken[tx.origin][i] = userLPToken[tx.origin][i].add(poolTokenAmount);
            userTotalLPToken[mAssets[i].lpToken] = userTotalLPToken[mAssets[i].lpToken].add(poolTokenAmount);
            mAssets[i].amountOfATotal = mAssets[i].amountOfATotal.add(amounts[1]);
            mAssets[i].amountOfBTotal = mAssets[i].amountOfATotal.add(_ustAmount);
        }
    }

    function withdraw(uint256 _amount, IERC20 _token) external {
        require(msg.sender == vault);

        address[] memory path;
        path[0] = address(mir);
        path[1] = address(ust);

        for (uint256 i = 0; i < mAssets.length; i++) {
            //uint shares = _amount.mul(1e18).div(userTotalLPToken[mAssets[i].lpToken]);

            //TODO - Check
            uint256 shares =
                _amount.mul(userTotalLPToken[mAssets[i].lpToken]).div(
                    userLPToken[tx.origin][i]
                );
            uint256 sharesToWithdrawFromPool =
                shares.mul(mAssets[i].weight).div(10000);

            (uint256 mAssetAmount, uint256 ustAmount) =
                router.removeLiquidity(
                    address(mAssets[i].mAssetToken),
                    address(ust),
                    sharesToWithdrawFromPool,
                    0,
                    0,
                    address(this),
                    block.timestamp
                );

            // mAsset -> UST on Uniswap
            path[0] = address(mAssets[i].mAssetToken);
            path[1] = address(ust);
            uint256[] memory amounts =
                router.swapExactTokensForTokens(
                    mAssetAmount,
                    0,
                    path,
                    address(this),
                    block.timestamp
                );

            // UST -> principalToken on Uniswap
            path[0] = address(ust);
            path[1] = address(_token);
            amounts = router.swapExactTokensForTokens(
                amounts[1].add(ustAmount),
                0,
                path,
                address(this),
                block.timestamp
            );

            userTotalLPToken[mAssets[i].lpToken] = userTotalLPToken[
                mAssets[i].lpToken
            ]
                .sub(sharesToWithdrawFromPool);
            userLPToken[tx.origin][i] = userLPToken[tx.origin][i].sub(
                sharesToWithdrawFromPool
            );
        }

        _token.safeTransfer(msg.sender, _token.balanceOf(address(this)));
    }

    function reInvest() external {
        uint256 totalEarnedMIR;
        for (uint256 i = 0; i < mAssets.length; i++) {
            uint earnedMIR = mAssets[i].lpPool.earned(address(this));

            //no incentive on mFB-UST farm
            if(earnedMIR > 0) {
                address[] memory path;
                path[0] = address(mir);
                path[1] = address(ust);
                mAssets[i].lpPool.getReward();

                totalEarnedMIR = totalEarnedMIR.add(earnedMIR);
                //45% of MIR is used in MIR-UST farm. Convert half of MIR(22.5%) to UST 
                //router.swapExactTokensForTokens(earnedMIR.mul(2250).div(10000), 0, path, address(this), block.timestamp);

                //45 - MIRUST farm, 10 - to wallet, remaining 45 (22.5 UST, 22.5 mAsset)

                //22.5(mirUst) + 22.5(mAssetUST)
                uint[] memory amounts = router.swapExactTokensForTokens(earnedMIR.mul(450).div(1000), 0, path, address(this), block.timestamp);
                
                path[1] = address(mAssets[i].mAssetToken);

                //22.5% mir to mAsset
                uint _mirAmount = earnedMIR.mul(2250).div(10000);
                amounts = router.swapExactTokensForTokens(_mirAmount, 0, path, address(this), block.timestamp);

                (,,uint poolTokenAmount) = router.addLiquidity(address(mAssets[i].mAssetToken), address(ust), _mirAmount, amounts[1], 0, 0, address(this), block.timestamp);
                
                mAssets[i].lpPool.stake(poolTokenAmount);
                
                userTotalLPToken[mAssets[i].lpToken] = userTotalLPToken[mAssets[i].lpToken].add(poolTokenAmount);
                mAssets[i].amountOfATotal = mAssets[i].amountOfATotal.add(_mirAmount);
                mAssets[i].amountOfBTotal = mAssets[i].amountOfATotal.add(amounts[1]);

            }
        }

        address[] memory path;
        path[0] = address(mir);
        path[1] = address(ust);

        mir.safeTransfer(treasuryWallet, totalEarnedMIR.div(10));//10 % 
        
        uint256 amountToReinvest = totalEarnedMIR.div(1000).mul(225);
        (,, uint poolTokenAmount) = router.addLiquidity(address(mir), address(ust), amountToReinvest, mir.balanceOf(address(this)), 0, 0, address(this), block.timestamp);
        mirustPool.stake(poolTokenAmount);
    }

    function getTotalAmountInPool() public view returns (uint256 value) {
        //get price of mAsset interms of UST
        //value = (amountOfmAsset*priceInUst) + amountOfUST
        for (uint256 i = 0; i < mAssets.length; i++) {
            
            address[] memory path;
            path[0] = address(mAssets[i].mAssetToken);
            path[0] = address(ust);
            uint[] memory priceInUst = router.getAmountsOut(1e18, path);

            value = value.add(priceInUst[1].mul(mAssets[i].amountOfATotal)).add(mAssets[i].amountOfBTotal);
        }

    }
}
