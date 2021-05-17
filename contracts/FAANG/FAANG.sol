// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "../../interfaces/ILPPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract FAANG {
    using SafeERC20 for IERC20;
    
    struct mAsset {
        uint256 weight;
        IERC20 mAssetToken;
        ILPPool lpPool;
        IERC20 lpToken;
    }

    address public wallet;
    IERC20 public principal;
    int128 public principalCurveId;
    IUniswapV2Router02 public router;
    ICurveFi public curveFi;
    IERC20 public mir;
    IERC20 public ust;
    ILPPool public mirustPool;
    IERC20 public mirustPoolToken;


    mapping (address => uint256[]) public userLPToken;
    mapping (IERC20 => uint256) public userTotalLPToken;
    mapping (ILPPool => uint256) public poolStakedMIRLPToken;
    uint256 public poolTotalStakedMIRLPToken;
    mAsset[] public mAssets;


    constructor (    
        address _wallet,
        IERC20 _principal,
        int128 _principalCurveId,
        IUniswapV2Router02 _router,
        ICurveFi _curveFi,
        IERC20 _mir,
        IERC20 _ust,
        ILPPool _mirustPool,
        IERC20 _mirustPoolToken
    ) public {
        wallet = _wallet;
        principal = _principal;
        principalCurveId = _principalCurveId;
        router = _router;
        principal.approve(router, type(uint256).max);
        curveFi = _curveFi;
        principal.approve(curveFi, type(uint256).max);
        mir = _mir;
        ust = _ust;
        mirustPool = _mirustPool;
        mirustPoolToken = _mirustPoolToken;
    }


    function deposit(uint256 _amount) {
        require(_amount > 0, "Amount should larger than zero");

        principal.safeTransferFrom(msg.sender, address(this), _amount); 

        // principal -> UST on Curve
        uint256 ustAmount = curveFi.exchange(principalCurveId, 0, _amount, 0, block.timestamp);

        address[2] memory path;
        uint[2] memory amounts;

        for (uint256 i = 0; i < mAssets.length; i++) {
            uint256 weight_ = mAssets[i].weight;
            address addr_ = address(mAssets[i].mAssetToken);

            // UST -> mAsset on Uniswap
            path[0] = address(ust);
            path[1] = addr_;
            amounts = router.swapExactTokensForTokens(ustAmount.mul(weight_).div(10000), 0, path, address(this), block.timestamp);

            // addLiquidity: mAsset + UST
            (uint mAssetUsedAmount, uint ustUsedAmount, uint poolTokenAmount) = router.addLiquidity(addr_, address(ust), amounts[1], ustAmount.mul(weight_).div(10000), 0, 0, address(this), block.timestamp);

            // stake LPToken to LPPool
            mAssets[i].lpPool.stake(poolTokenAmount);

            userLPToken[msg.sender][i] += poolTokenAmount;
            userTotalLPToken[mAssets[i].lpToken] += poolTokenAmount;
        }
    }




    function reInvest() external {
        uint256 mirAmount;
        uint256 tokenAUsedAmount;
        uint256 tokenBUsedAmount;
        uint256 poolTokenAmount;
        address[2] memory path;
        uint[2] memory amounts;

        for (uint256 i = 0; i < mAssets.length; i++) {
            path[0] = address(mir);
            path[1] = address(ust);

            // get rewarded MIR
            mirAmount = mAssets[i].lpPool.earned();
            mAssets[i].lpPool.getReward();

            // 67.5% MIR -> UST on Uniswap
            amounts = router.swapExactTokensForTokens(mirAmount.mul(675).div(1000), 0, path, address(this), block.timestamp);
            uint256 ustAmount = amounts[1];

            path[0] = address(ust);
            path[1] = address(mAssets[i].mAssetToken);
            
            // 1/3 UST -> mAsset on Uniswap
            amounts = router.swapExactTokensForTokens(ustAmount.div(3), 0, path, address(this), block.timestamp);
            uint256 mAssetAmount = amounts[1];
            // addLiquidity: mAsset + 1/3 UST
            (tokenAUsedAmount, tokenBUsedAmount, poolTokenAmount) = router.addLiquidity(mAssets[i].addr, address(ust), mAssetAmount, ustAmount.div(3), 0, 0, address(this), block.timestamp);
            // stake LPToken to LPPool
            mAssets[i].lpPool.stake(poolTokenAmount);

            // addLiquidity: 22.5% MIR + 1/3 UST
            (tokenAUsedAmount, tokenBUsedAmount, poolTokenAmount) = router.addLiquidity(address(mir), address(ust), mirAmount.mul(225).div(1000), ustAmount.div(3), 0, 0, address(this), block.timestamp);
            // stake MIRUSTPoolToken to MIRUSTPool
            mirustPool.stake(poolTokenAmount);

            // transfer 10% MIR to wallet
            mir.transfer(wallet, mirAmount.div(10));

            poolStakedMIRLPToken[mAssets[i].lpPool] += poolTokenAmount;
            poolTotalStakedMIRLPToken += poolTokenAmount;
        }


        /// reinvest using rewarded MIR from MIR-UST pool
        path[0] = address(mir);
        path[1] = address(ust);

        // get rewarded MIR from MIR-UST pool
        mirAmount = mirustPool.earned();
        mirustPool.getReward();

        // 45% MIR -> UST on Uniswap
        amounts = router.swapExactTokensForTokens(mirAmount.mul(45).div(100), 0, path, address(this), block.timestamp);
        // addLiquidity: 45% MIR + UST
        (tokenAUsedAmount, tokenBUsedAmount, poolTokenAmount) = router.addLiquidity(address(mir), address(ust), mirAmount.mul(45).div(100), amounts[1], 0, 0, address(this), block.timestamp);
        // stake MIRUSTPoolToken to MIRUSTPool
        mirustPool.stake(poolTokenAmount);

        // transfer 10% MIR to wallet
        mir.transfer(wallet, mirAmount.div(10));
    }

    function withdraw(ILPPool _lpPool, uint256 _lpTokenAmount) {
        (uint256 userLPToken, uint256 totalProfitFee) = getUerLPToken(_lpToken, msg.sender);
        require(_lpTokenAmount <= userLPToken, "LPToken not enough");

        uint256 lpTokenAmount = _lpTokenAmount.mul(totalProfitFee.div(userLPToken).add(1));
        (uint256 poolId, , IERC20 lpToken, IERC20 mAssetToken) = getmAssetPoolInfo(_lpPool);
        address[2] memory path;
        uint256[2] memory amounts;

        userLPToken[msg.sender][poolId] -= lpTokenAmount;
        userTotalLPToken[lpToken] -= lpTokenAmount;

        // ??????????????????
        //poolStakedMIRLPToken[_lpPool] -= poolTokenAmount;
        //poolTotalStakedMIRLPToken -= poolTokenAmount;

        // unstake poolToken
        _lpPool.withdraw(lpTokenAmount);

        // remove liquidity: poolToken -> mAsset + UST
        (uint256 mAssetAmount, uint256 ustAmount) = router.removeLiquidity(mAssetToken, address(ust), lpTokenAmount, 0, 0, address(this), block.timestamp);

        // mAsset -> UST on Uniswap
        path[0] = address(mAssetToken);
        path[1] = address(ust);
        amounts = router.swapExactTokensForTokens(mAssetAmount, 0, path, address(this), block.timestamp);

        // UST -> principalToken on Uniswap
        path[0] = address(ust);
        path[1] = address(principal);
        amounts = router.swapExactTokensForTokens(amounts[1].add(ustAmount), 0, path, address(this), block.timestamp);

        principal.safeTransfer(msg.sender, amounts[1].mul(_lpTokenAmount).div(lpTokenAmount));
        principal.safeTransfer(wallet, amounts[1].mul(lpTokenAmount.sub(_lpTokenAmount).div(lpTokenAmount)));
    }



    function getUerLPToken(ILPPool _lpPool, address user) view returns(uint256 userLPToken, uint256 totalProfitFee) {
        (uint256 poolId, , IERC20 lpToken, IERC20 mAssetToken) = getmAssetPoolInfo(_lpPool);

        if (mirustPool == _lpPool) {
            for (uint256 i = 0; i < mAssets.length; i++) {
                userLPToken = userLPToken + 
                mirustPoolToken.balanceOf(address(this)) * 
                poolStakedMIRLPToken[mAssets[i].lpPool] / 
                poolTotalStakedMIRLPToken * 
                userBalances[user].stakedLPToken[i] / 
                usersTotalLPTokens[_lpTokenAddr];
            }
        } else {
            userLPToken = lpToken.balanceOf(address(this)) * userLPToken[user][poolId] / userTotalLPToken[lpToken];
        }

        totalProfitFee = userLPToken.sub(userLPToken[user][poolId]).div(5);
    }




    function getmAssetPoolInfo(ILPPool _lpPool) view returns(uint256 poolId, uint256 weight, IERC20 lpToken, IERC20 mAssetToken) {
        for (uint256 i = 0; i < mAssets.length; i++) {
            if (_lpPool == mAssets[i].lpPool) {
                poolId = i;
                weight = mAssets[i].weight;
                lpToken = mAssets[i].lpToken;
                mAssetToken = mAssets[i].mAssetToken;
            }
        }
    }


    function setmAsset() onlyOwner returns() {
        struct mAsset {
        uint256 weight;
        IERC20 mAssetToken;
        ILPPool lpPool;
        IERC20 lpToken;
    }

    }





}