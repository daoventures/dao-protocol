// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICrPool {
    function add_liquidity(uint256[2] memory _amounts, uint256 _minMintAmt) external returns (uint256);
    function add_liquidity(uint256[2] memory _amounts, uint256 _minMintAmt, bool _useUnderlying) external returns (uint256);
    function add_liquidity(uint256[3] memory _amounts, uint256 _minMintAmt) external;
    function add_liquidity(uint256[3] memory _amounts, uint256 _minMintAmt, bool _useUnderlying) external returns (uint256);
    function add_liquidity(uint256[4] memory _amounts, uint256 _minMintAmt) external;
    function add_liquidity(uint256[4] memory _amounts, uint256 _minMintAmt, bool _useUnderlying) external returns (uint256);
    function remove_liquidity(uint256 _amount, uint256[4] memory _min_amounts) external;
    function remove_liquidity_one_coin(uint256 _amountIn, int128 _index, uint256 _minAmtOut) external;
    function remove_liquidity_one_coin(uint256 _amountIn, int128 _index, uint256 _minAmtOut, bool _useUnderlying) external;
    function exchange(int128 _fromIndex, int128 _toIndex, uint256 _amount, uint256 _amountOutMin) external;
    function coins(int128 _index) external view returns (address);
    function get_virtual_price() external view returns (uint256);
}

interface ICrRegistry {
    function get_pool_from_lp_token(address _lp_token) external view returns (address);
    function get_coins(address _pool) external view returns (address[8] memory);
    function get_n_coins(address _pool) external view returns (uint256[2] memory);
    function get_pool_name(address _pool) external view returns (string calldata);
    function is_meta(address _pool) external view returns (bool);
}

interface ICrZap {
    function add_liquidity(uint256[2] memory _depositAmts, uint256 _minMinAmt) external;
    function add_liquidity(uint256[3] memory _depositAmts, uint256 _minMinAmt) external;
    function add_liquidity(uint256[4] memory _depositAmts, uint256 _minMinAmt) external;
    function remove_liquidity_one_coin(uint256 _amountIn, int128 _coinIndex, uint256 _minAmtOut) external;
}

interface ICvVault {
    function deposit(uint256 _pid, uint256 _amount, bool _stake) external returns (bool);
    function withdraw(uint256 _pid, uint256 _amount) external returns(bool);
    function poolInfo(uint256 _pid) external view returns (address, address, address, address, address, bool);
}

interface ICvStake {
    function balanceOf(address _account) external view returns (uint256);
    function withdrawAndUnwrap(uint256 _amount, bool _claim) external returns(bool);
    // withdrawAndUnwrap(): this function withdraw directly to curve LP token
    function getReward() external returns(bool);
    function extraRewards(uint256 _index) external view returns (address);
    function extraRewardsLength() external view returns (uint256);
}

interface ICvRewards {
    function rewardToken() external view returns (address);
}

interface ISushiRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

interface IZapReward {
    function swapRewardTokenToDAI(address _rewardToken) external returns (uint256);
}

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

interface IWETH is IERC20 {
    function withdraw(uint256 _amount) external;
}

contract EarnStrategy is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    /**
     lpToken: Curve LP token 
     crPoolType: 0 for plain pools, 1 for meta pools, 2 for lending pools
     */
    struct PoolInfo {
        string poolName;
        IERC20 lpToken;
        ICvStake cvStake;
        ICrPool crPool;
        uint256 crPoolType;
        address[8] coins;
        IERC20[] extraRewardTokens;
    }
    mapping(uint256 => PoolInfo) public poolInfos;
    mapping(address => address) private _crZapAddrs; // For old lending pools

    ICrRegistry private constant _crRegistry = ICrRegistry(0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5);
    ICvVault private constant _cvVault = ICvVault(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    ISushiRouter private constant _sushiRouter = ISushiRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    IZapReward public zapReward; // For zapping extra reward tokens

    IWETH private constant _WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 private constant _USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 private constant _USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 private constant _DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 private constant _CVX = IERC20(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    IERC20 private constant _CRV = IERC20(0xD533a949740bb3306d119CC777fa900bA034cd52);
    IERC20 private constant _3Crv = IERC20(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);

    uint256 public poolIndex; // Current invest pool
    ICrPool private constant _3Pool = ICrPool(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    address public vault;

    // Fees
    uint256 public yieldFeePerc = 1000;
    address public admin;
    address public communityWallet;
    address public strategist;

    event SetVault(address vaultAddress);
    event SetCommunityWallet(address communityWalletAddress);
    event SetAdmin(address adminAddress);
    event SetStrategist(address strategistAddress);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    constructor() {
        _CVX.safeApprove(address(_sushiRouter), type(uint256).max);
        _CRV.safeApprove(address(_sushiRouter), type(uint256).max);
        _DAI.safeApprove(address(_sushiRouter), type(uint256).max);

        _USDT.safeApprove(address(_3Pool), type(uint).max);
        _USDC.safeApprove(address(_3Pool), type(uint).max);
        _DAI.safeApprove(address(_3Pool), type(uint).max);
        // Hardcode corresponding zap address for all old Curve lending pools
        _crZapAddrs[0x79a8C46DeA5aDa233ABaFFD40F3A0A2B1e5A4F27] = 0xb6c057591E073249F2D9D88Ba59a46CFC9B59EdB; // BUSD
        _crZapAddrs[0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56] = 0xeB21209ae4C2c9FF2a86ACA31E123764A3B6Bc06; // Compound
        _crZapAddrs[0x06364f10B501e868329afBc005b3492902d6C763] = 0xA50cCc70b6a011CffDdf45057E39679379187287; // PAX
        _crZapAddrs[0x52EA46506B9CC5Ef470C5bf89f17Dc28bB35D85C] = 0xac795D2c97e60DF6a99ff1c814727302fD747a80; // USDT
        _crZapAddrs[0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51] = 0xbBC81d23Ea2c3ec7e56D39296F0cbB648873a5d3; // Y
    }

    /// @notice Function to invest Stablecoins into farm
    /// @param _amtUSDT 6 decimals
    /// @param _amtUSDC 6 decimals
    /// @param _amtDAI 18 decimals
    function invest(uint256 _amtUSDT, uint256 _amtUSDC, uint256 _amtDAI) external onlyVault {
        if (_amtUSDT > 0) {
            _USDT.safeTransferFrom(address(vault), address(this), _amtUSDT);
        }
        if (_amtUSDC > 0) {
            _USDC.safeTransferFrom(address(vault), address(this), _amtUSDC);
        }
        if (_amtDAI > 0) {
            _DAI.safeTransferFrom(address(vault), address(this), _amtDAI);
        }
        _invest(_amtUSDT, _amtUSDC, _amtDAI);
    }

    /// @notice Derived function from invest()
    /// @param _amtUSDT 6 decimals
    /// @param _amtUSDC 6 decimals
    /// @param _amtDAI 18 decimals
    function _invest(uint256 _amtUSDT, uint256 _amtUSDC, uint256 _amtDAI) private {        
        PoolInfo memory _poolInfo = poolInfos[poolIndex];
        ICrPool _crPool = _poolInfo.crPool;

        if (_poolInfo.crPoolType == 0) { // Curve plain pools
            // Direct deposit into pool
            uint256[4] memory _amounts;
            _amounts[0] = _amtDAI;
            _amounts[1] = _amtUSDC;
            _amounts[2] = _amtUSDT;
            _amounts[3] = 0; // pool base Stablecoin
            _crPool.add_liquidity(_amounts, 0);
            _cvVault.deposit(poolIndex, _poolInfo.lpToken.balanceOf(address(this)), true);
        } else if (_poolInfo.crPoolType == 1) { // Curve meta pools
            // Need to deposit into Curve 3pool first, then deposit 3Crv to pool
            uint256[3] memory _amounts_3Pool;
            _amounts_3Pool[0] = _amtDAI;
            _amounts_3Pool[1] = _amtUSDC;
            _amounts_3Pool[2] = _amtUSDT;
            _3Pool.add_liquidity(_amounts_3Pool, 0);
            uint256[2] memory _amounts;
            _amounts[0] = 0;
            _amounts[1] = _3Crv.balanceOf(address(this));
            _crPool.add_liquidity(_amounts, 0);
            _cvVault.deposit(poolIndex, _poolInfo.lpToken.balanceOf(address(this)), true);
        } else { // Curve lending pools
            uint256 _coinLength = (_crRegistry.get_n_coins(address(_crPool)))[1];
            address _crZapAddr = _crZapAddrs[address(_crPool)];
            if (_crZapAddr != address(0)) { // Old lending pools
                // Need to use zap contract to zap Stablecoins into pool
                ICrZap _crZap = ICrZap(_crZapAddr);
                if (_coinLength == 4) {
                    uint256[4] memory _amounts;
                    _amounts[0] = _amtDAI;
                    _amounts[1] = _amtUSDC;
                    _amounts[2] = _amtUSDT;
                    _amounts[3] = 0;
                    _crZap.add_liquidity(_amounts, 0);
                } else if (_coinLength == 3) {
                    uint256[3] memory _amounts;
                    _amounts[0] = _amtDAI;
                    _amounts[1] = _amtUSDC;
                    _amounts[2] = _amtUSDT;
                    _crZap.add_liquidity(_amounts, 0);
                } else { // _coinLength == 2
                    // Pools that only accept DAI & USDC
                    if (_amtUSDC > 1e6) {
                        _3Pool.exchange(1, 0, _amtUSDC, 0);
                    }
                    if (_amtUSDT > 1e6) {
                        _3Pool.exchange(2, 0, _amtUSDT, 0);
                    }
                    uint256[2] memory _amounts;
                    _amounts[0] = _DAI.balanceOf(address(this));
                    _amounts[1] = 0;
                    _crZap.add_liquidity(_amounts, 0);
                }
            } else { // New lending pools (no record found in _crZapAddrs)
                // Pools itself contain zapping function to zap Stablecoins into pool
                if (_coinLength == 4) {
                    uint256[4] memory _amounts;
                    _amounts[0] = _amtDAI;
                    _amounts[1] = _amtUSDC;
                    _amounts[2] = _amtUSDT;
                    _amounts[3] = 0;
                    _crPool.add_liquidity(_amounts, 0, true);
                } else if (_coinLength == 3) {
                    uint256[3] memory _amounts;
                    _amounts[0] = _amtDAI;
                    _amounts[1] = _amtUSDC;
                    _amounts[2] = _amtUSDT;
                    _crPool.add_liquidity(_amounts, 0, true);
                } else { // _coinLength == 2
                    // Pools that only accept DAI & USDC
                    if (_amtUSDC > 1e6) {
                        _3Pool.exchange(1, 0, _amtUSDC, 0);
                    }
                    if (_amtUSDT > 1e6) {
                        _3Pool.exchange(2, 0, _amtUSDT, 0);
                    }
                    uint256[2] memory _amounts;
                    _amounts[0] = _DAI.balanceOf(address(this));
                    _amounts[1] = 0;
                    _crPool.add_liquidity(_amounts, 0, true);
                }
            }
            _cvVault.deposit(poolIndex, _poolInfo.lpToken.balanceOf(address(this)), true);
        }
    }

    /// @notice Function to harvest rewards from farm and reinvest
    function yield() external onlyVault {
        uint256 _DAIBalance = _yield();
        _invest(0, 0, _DAIBalance);
    }

    /// @notice Derived function from yield()
    /// @notice Rewards will be in form of DAI token because it is the most acceptable token in all Curve USD pools
    function _yield() private returns (uint256) {
        PoolInfo memory _poolInfo = poolInfos[poolIndex];
        ICvStake _cvStake = _poolInfo.cvStake;
        _cvStake.getReward();

        if (_CVX.balanceOf(address(this)) > 0) {
            _swap(address(_CVX), address(_DAI), _CVX.balanceOf(address(this)));
        }
        if (_CRV.balanceOf(address(this)) > 0) {
            _swap(address(_CRV), address(_DAI), _CRV.balanceOf(address(this)));
        }

        // Dealing with extra Reward tokens
        if (_poolInfo.extraRewardTokens.length > 0) {
            IERC20[] memory _extraRewardTokens = _poolInfo.extraRewardTokens;
            for (uint256 _i = 0; _i < _poolInfo.extraRewardTokens.length; _i++) {
                IERC20 _extraRewardToken = _extraRewardTokens[_i];
                if (_extraRewardToken.balanceOf(address(this)) > 0) {
                    // We do token approval here, because the reward tokens have many kinds
                    if (_extraRewardToken.allowance(address(this), address(zapReward)) == 0) {
                        _extraRewardToken.safeApprove(address(zapReward), type(uint256).max);
                    }
                    // zapReward contract is a customized zap contract to swap various kinds of token
                    // This contract might change time to time if there is any new token that haven't include in
                    zapReward.swapRewardTokenToDAI(address(_extraRewardToken));
                }
            }
        }

        // Split yield fees
        uint256 _DAIBalance = _DAI.balanceOf(address(this));
        uint256 _yieldFee;
        if (_DAIBalance > 0) {
            _yieldFee = _DAIBalance - (_DAIBalance * yieldFeePerc / 10000);
            address[] memory _path = new address[](2);
            _path[0] = address(_DAI);
            _path[1] = address(_WETH);
            uint256[] memory _amounts = _sushiRouter.swapExactTokensForTokens(_yieldFee, 0, _path, address(this), block.timestamp);
            _WETH.withdraw(_amounts[1]);
            uint256 _yieldFeeInETH = address(this).balance * 2 / 5;
            (bool _a,) = admin.call{value: _yieldFeeInETH}(""); // 40%
            require(_a, "Fee transfer failed");
            (bool _t,) = communityWallet.call{value: _yieldFeeInETH}(""); // 40%
            require(_t, "Fee transfer failed");
            (bool _s,) = strategist.call{value: (address(this).balance)}(""); // 20%
            require(_s, "Fee transfer failed");
        }

        return _DAIBalance - _yieldFee;
    }

    // To enable receive ETH from WETH in _yield()
    receive() external payable {}

    /// @notice Function to withdraw Stablecoins from farm
    /// @param _amount Amount to withdraw in USD (6 decimals)
    /// @param _coinIndex Type of Stablecoin to withdraw
    /// @return Amount of actual withdraw in USD (6 decimals)
    function withdraw(uint256 _amount, uint256 _coinIndex) external onlyVault returns (uint256) {
        IERC20 _token;
        int128 _curveIndex;
        if (_coinIndex == 0) {
            _token = _USDT;
            _curveIndex = 2;
        } else if (_coinIndex == 1) {
            _token = _USDC;
            _curveIndex = 1;
        } else {
            _token = _DAI;
            _curveIndex = 0;
        }

        _withdraw(_amount, _curveIndex);
        uint256 _withdrawAmt = _token.balanceOf(address(this));
        _token.safeTransfer(address(vault), _withdrawAmt);
        if (_token == _DAI) { // To make consistency of 6 decimals return
            _withdrawAmt = _withdrawAmt / 1e12;
        }
        return _withdrawAmt;
    }

    function _withdraw(uint256 _amount, int128 _curveIndex) private {
        PoolInfo memory _poolInfo = poolInfos[poolIndex];
        ICrPool _crPool = _poolInfo.crPool;
        ICvStake _cvStake = _poolInfo.cvStake;

        uint256 _withdrawLpTokenAmt = _amount * _cvStake.balanceOf(address(this)) / getTotalPool();
        _cvStake.withdrawAndUnwrap(_withdrawLpTokenAmt, false);

        if (_poolInfo.crPoolType == 0) { // Curve plain pools
            uint256[4] memory _amounts;
            _amounts[0] = 0;
            _amounts[1] = 0;
            _amounts[2] = 0;
            _amounts[3] = 0;
            _crPool.remove_liquidity(_withdrawLpTokenAmt, _amounts);

            for (int128 _i = 0; _i < 4; _i ++) {
                if (_i != _curveIndex) {
                    address _coinAddr = _crPool.coins(_i);
                    IERC20 _coin = IERC20(_coinAddr);
                    _crPool.exchange(_i, _curveIndex, _coin.balanceOf(address(this)), 0);
                }
            }
        } else if (_poolInfo.crPoolType == 1) { // Curve meta pools
            _crPool.remove_liquidity_one_coin(_withdrawLpTokenAmt, 1, 0);
            _3Pool.remove_liquidity_one_coin(_3Crv.balanceOf(address(this)), _curveIndex, 0);
        } else { // Curve lending pools
            address _crZapAddr = _crZapAddrs[address(_crPool)];
            if (_crZapAddr != address(0)) { // old lending pools
                ICrZap _crZap = ICrZap(_crZapAddr);
                if (_crZapAddr == 0xeB21209ae4C2c9FF2a86ACA31E123764A3B6Bc06) { // Compound zap contract
                    if (_curveIndex == 2) {
                        _crZap.remove_liquidity_one_coin(_withdrawLpTokenAmt, 0, 0);
                        _3Pool.exchange(0, 2, _DAI.balanceOf(address(this)), 0);
                    } else {
                        _crZap.remove_liquidity_one_coin(_withdrawLpTokenAmt, _curveIndex, 0);
                    }
                } else {
                    _crZap.remove_liquidity_one_coin(_withdrawLpTokenAmt, _curveIndex, 0);
                }
            } else { // new lending pools
                _crPool.remove_liquidity_one_coin(_withdrawLpTokenAmt, 0, 0, true);
                if (_curveIndex != 0) {
                    _3Pool.exchange(0, _curveIndex, _DAI.balanceOf(address(this)), 0);
                }
            }
        }
    }

    function _swap(address _tokenA, address _tokenB, uint256 _amount) private {
        address[] memory _path = new address[](3);
        _path[0] = _tokenA;
        _path[1] = address(_WETH);
        _path[2] = _tokenB;
        _sushiRouter.swapExactTokensForTokens(_amount, 0, _path, address(this), block.timestamp);
    }

    /// @notice Function to withdraw all funds from farm and transfer to vault
    function emergencyWithdraw() external onlyVault {
        _yield();
        _withdraw(getTotalPool(), 2);
        _USDT.safeTransfer(vault, _USDT.balanceOf(address(this)));
    }

    function addPool(uint256 _pid) external {
        (address _lpTokenAddr, , , address _cvStakeAddr, , ) = _cvVault.poolInfo(_pid);
        address _crPoolAddr = _crRegistry.get_pool_from_lp_token(_lpTokenAddr);
        ICrPool _crPool = ICrPool(_crPoolAddr);
        ICvStake _cvStake = ICvStake(_cvStakeAddr);
        uint256 _crPoolType;
        address _crZapAddr;

        IERC20 _lpToken = IERC20(_lpTokenAddr);
            _lpToken.safeApprove(address(_cvVault), type(uint256).max);

        address[8] memory _coins = _crRegistry.get_coins(_crPoolAddr);
        if (_crRegistry.is_meta(_crPoolAddr)) { // Curve Metapool
                _3Crv.safeApprove(_crPoolAddr, type(uint256).max);
            _crPoolType = 1;
        } else {
            if (_coins[0] == address(_DAI)) { // Curve Plain Pool
                    _USDT.safeApprove(address(_crPool), type(uint256).max);
                    _USDC.safeApprove(address(_crPool), type(uint256).max);
                    _DAI.safeApprove(address(_crPool), type(uint256).max);
                    IERC20(_coins[3]).safeApprove(address(_crPool), type(uint256).max);
                _crPoolType = 0;
            } else { // Curve Lending Pool
                _crZapAddr = _crZapAddrs[_crPoolAddr];
                if (_crZapAddr != address(0)) {
                        _USDT.safeApprove(_crZapAddr, type(uint256).max);
                        _USDC.safeApprove(_crZapAddr, type(uint256).max);
                        _DAI.safeApprove(_crZapAddr, type(uint256).max);
                        _lpToken.safeApprove(_crZapAddr, type(uint256).max);
                } else {
                        _USDT.safeApprove(_crPoolAddr, type(uint256).max);
                        _USDC.safeApprove(_crPoolAddr, type(uint256).max);
                        _DAI.safeApprove(_crPoolAddr, type(uint256).max);
                        _lpToken.safeApprove(_crPoolAddr, type(uint256).max);
                }
                _crPoolType = 2;
            }
        }

        IERC20[] memory _extraRewards;
        uint256 _extraRewardsLength = _cvStake.extraRewardsLength();
        if (_extraRewardsLength > 0) {
            _extraRewards = new IERC20[](_extraRewardsLength);
            for (uint256 _i = 0; _i < _extraRewardsLength; _i++) {
                address _tokenAddr = ICvRewards(_cvStake.extraRewards(_i)).rewardToken();
                IERC20 _extraRewardToken = IERC20(_tokenAddr);
                _extraRewards[_i] = _extraRewardToken;
            }
        }

        poolInfos[_pid] = PoolInfo(
            _crRegistry.get_pool_name(_crPoolAddr),
            _lpToken,
            _cvStake,
            _crPool,
            _crPoolType,
            _coins,
            _extraRewards
        );
    }

    function switchPool(uint256 _pid) external onlyVault {
        if (poolIndex != 0) {
            _yield();
            _withdraw(getTotalPool(), 0);
            poolIndex = _pid;
            _invest(0, 0, _DAI.balanceOf(address(this)));
        } else {
            poolIndex = _pid;
        }
    }

    /// @notice Function to set vault address that interact with this contract. This function can only execute once when deployment.
    /// @param _vault Address of vault contract
    function setVault(address _vault) external onlyOwner {
        require(vault == address(0), "Vault set");
        vault = _vault;
        emit SetVault(_vault);
    }

    function setZapReward(address _zapReward) external {
        zapReward = IZapReward(_zapReward);
    }

    function setCommunityWallet(address _communityWallet) external onlyVault {
        communityWallet = _communityWallet;
        emit SetCommunityWallet(_communityWallet);
    }

    /// @notice Function to set new admin address from vault contract
    /// @param _admin Address of new admin
    function setAdmin(address _admin) external onlyVault {
        admin = _admin;
        emit SetAdmin(_admin);
    }

    /// @notice Function to set new strategist address from vault contract
    /// @param _strategist Address of new strategist
    function setStrategist(address _strategist) external onlyVault {
        strategist = _strategist;
        emit SetStrategist(_strategist);
    }

    /// @notice Function to get current price of ETH
    /// @return Current price of ETH in USD (8 decimals)
    function _getCurrentPriceOfETHInUSD() private view returns (uint256) {
        IChainlink _pricefeed = IChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
        return uint256(_pricefeed.latestAnswer());
    }

    /// @notice Get total pool
    /// @return Total pool in USD (6 decimals)
    function getTotalPool() public view returns (uint256) {
        PoolInfo memory poolInfo = poolInfos[poolIndex];
        ICrPool _crPool = poolInfo.crPool;
        ICvStake _cvStake = poolInfo.cvStake;
        uint256 _virtualPrice = _crPool.get_virtual_price();
        uint256 _lpTokenBalance = _cvStake.balanceOf(address(this));
        return _lpTokenBalance * _virtualPrice / 1e30;
    }
}