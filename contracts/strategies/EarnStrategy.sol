// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface ICurveZap {
    function compound(uint256 _amount, address _vault) external returns (uint256);
    function emergencyWithdraw(uint256 _amount, address _vault) external;
}

interface ICvVault {
    function deposit(uint256 _pid, uint256 _amount, bool _stake) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function poolInfo(uint256 _pid) external view returns (address, address, address, address, address, bool);
}

interface ICvStake {
    function balanceOf(address _account) external view returns (uint256);
    function withdrawAndUnwrap(uint256 _amount, bool _claim) external;
    function getReward() external returns(bool);
    function extraRewards(uint256 _index) external view returns (address);
    function extraRewardsLength() external view returns (uint256);
}

interface ICvRewards {
    function rewardToken() external view returns (address);
}

interface ISushiRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

interface IWETH is IERC20Upgradeable {
    function withdraw(uint256 _amount) external;
}

contract EarnStrategy is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IWETH;

    ISushiRouter private constant _sushiRouter = ISushiRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    ICvVault private constant _cvVault = ICvVault(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    ICvStake public cvStake;
    ICurveZap public curveZap;

    IWETH private constant _WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20Upgradeable private constant _CVX = IERC20Upgradeable(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    IERC20Upgradeable private constant _CRV = IERC20Upgradeable(0xD533a949740bb3306d119CC777fa900bA034cd52);
    IERC20Upgradeable public lpToken;

    address public vault;
    uint256 public pid; // Index for Convex pool

    // Fees
    uint256 public yieldFeePerc;
    address public admin;
    address public communityWallet;
    address public strategist;

    event Invest(uint256 amount);
    event Yield(uint256 amtToCompound, uint256 lpTokenBal);
    event YieldFee(uint256 yieldFee);
    event Withdraw(uint256 lpTokenBalance);
    event EmergencyWithdraw(uint256 lpTokenBalance);
    event SetVault(address indexed vaultAddress);
    event SetCurveZap(address indexed curveZap);
    event SetYieldFeePerc(uint256 indexed percentage);
    event SetCommunityWallet(address indexed communityWalletAddress);
    event SetAdmin(address indexed adminAddress);
    event SetStrategist(address indexed strategistAddress);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    /// @notice Initialize this strategy contract
    /// @notice This function can only be execute once (by strategy factory contract)
    /// @param _pid Index of pool in Convex
    /// @param _curveZap Address of CurveZap contract
    /// @param _admin Address of admin
    /// @param _communityWallet Address of community wallet
    /// @param _strategist Address of strategist
    function initialize(
        uint256 _pid, address _curveZap,
        address _admin, address _communityWallet, address _strategist
    ) external initializer {
        __Ownable_init();

        yieldFeePerc = 2000;
        admin = _admin;
        communityWallet = _communityWallet;
        strategist = _strategist;
        curveZap = ICurveZap(_curveZap);
        pid = _pid;

        _CVX.safeApprove(address(_sushiRouter), type(uint256).max);
        _CRV.safeApprove(address(_sushiRouter), type(uint256).max);
        _WETH.safeApprove(_curveZap, type(uint256).max);

        // Add pool
        (address _lpTokenAddr, , , address _cvStakeAddr, , ) = _cvVault.poolInfo(_pid);
        lpToken = IERC20Upgradeable(_lpTokenAddr);
        lpToken.safeApprove(address(_cvVault), type(uint256).max);
        cvStake = ICvStake(_cvStakeAddr);
    }

    /// @notice Function to invest token into Convex
    /// @param _amount Amount to invest (18 decimals)
    function invest(uint256 _amount) external {
        require(msg.sender == vault || msg.sender == address(curveZap), "Only authorized caller");
        lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        _cvVault.deposit(pid, _amount, true);
        emit Invest(_amount);
    }

    /// @notice Function to yield farms rewards
    function yield() external onlyVault {
        cvStake.getReward();
        uint256 _amtToCompound = _yield();
        // Deposit _amtToCompound (in WETH) to CurveZap contract, zap it to LP token and transfer back here
        uint256 _lpTokenBal = curveZap.compound(_amtToCompound, address(vault));
        emit Yield(_amtToCompound, _lpTokenBal);
    }

    /// @notice Derived function from yield()
    function _yield() private returns (uint256) {
        uint256 _CVXBalance = _CVX.balanceOf(address(this));
        if (_CVXBalance > 0) {
            _swap(address(_CVX), address(_WETH), _CVXBalance);
        }
        uint256 _CRVBalance = _CRV.balanceOf(address(this));
        if (_CRVBalance > 0) {
            _swap(address(_CRV), address(_WETH), _CRVBalance);
        }
        // Dealing with extra reward tokens if available
        if (cvStake.extraRewardsLength() > 0) {
            // Extra reward tokens might more than 1
            for (uint256 _i = 0; _i < cvStake.extraRewardsLength(); _i++) {
                IERC20Upgradeable _extraRewardToken = IERC20Upgradeable(ICvRewards(cvStake.extraRewards(_i)).rewardToken());
                uint256 _extraRewardTokenBalance = _extraRewardToken.balanceOf(address(this));
                if (_extraRewardTokenBalance > 0) {
                    // We do token approval here, because the reward tokens have many kinds and 
                    // might be added in future by Convex
                    if (_extraRewardToken.allowance(address(this), address(_sushiRouter)) == 0) {
                        _extraRewardToken.safeApprove(address(_sushiRouter), type(uint256).max);
                    }
                    _swap(address(_extraRewardToken), address(_WETH), _extraRewardTokenBalance);
                }
            }
        }

        // Split yield fees
        uint256 _WETHBalance = _WETH.balanceOf(address(this));
        uint256 _yieldFee = _WETHBalance - (_WETHBalance * yieldFeePerc / 10000);
        _WETH.withdraw(_yieldFee);
        uint256 _yieldFeeInETH = address(this).balance * 2 / 5;
        (bool _a,) = admin.call{value: _yieldFeeInETH}(""); // 40%
        require(_a, "Fee transfer failed");
        (bool _t,) = communityWallet.call{value: _yieldFeeInETH}(""); // 40%
        require(_t, "Fee transfer failed");
        (bool _s,) = strategist.call{value: (address(this).balance)}(""); // 20%
        require(_s, "Fee transfer failed");

        emit YieldFee(_yieldFee);
        return _WETHBalance - _yieldFee;
    }

    // To enable receive ETH from WETH in _yield()
    receive() external payable {}

    /// @notice Function to withdraw token from Convex
    /// @param _amount Amount of token to withdraw (18 decimals)
    function withdraw(uint256 _amount) external onlyVault returns (uint256 _lpTokenBal) {
        cvStake.withdrawAndUnwrap(_amount, false);
        _lpTokenBal = lpToken.balanceOf(address(this));
        lpToken.safeTransfer(address(vault), _lpTokenBal);
        emit Withdraw(_lpTokenBal);
    }

    /// @notice Swap tokens with Sushi
    /// @param _tokenA Token to be swapped
    /// @param _tokenB Token to be received
    /// @param _amount Amount of token to be swapped
    function _swap(address _tokenA, address _tokenB, uint256 _amount) private {
        address[] memory _path = new address[](2);
        _path[0] = _tokenA;
        _path[1] = _tokenB;
        _sushiRouter.swapExactTokensForTokens(_amount, 0, _path, address(this), block.timestamp);
    }

    /// @notice Function to withdraw all funds from farm and transfer to vault
    function emergencyWithdraw() external onlyVault {
        cvStake.withdrawAndUnwrap(getTotalPool(), true);
        uint256 _amtToDeposit = _yield();
        curveZap.emergencyWithdraw(_amtToDeposit, address(vault));
        uint256 _lpTokenBal = lpToken.balanceOf(address(this));
        lpToken.safeTransfer(address(vault), _lpTokenBal);
        emit EmergencyWithdraw(_lpTokenBal);
    }

    /// @notice Function to set vault address that interact with this contract. This function can only execute once when deployment.
    /// @param _vault Address of vault contract
    function setVault(address _vault) external {
        require(vault == address(0), "Vault set");
        vault = _vault;
        emit SetVault(_vault);
    }

    /// @notice Function to set new CurveZap contract address from vault contract
    /// @param _curveZap Address of new CurveZap contract
    function setCurveZap(address _curveZap) external onlyVault {
        curveZap = ICurveZap(_curveZap);
        _WETH.safeApprove(_curveZap, type(uint256).max);
        emit SetCurveZap(_curveZap);
    }

    /// @notice Function to set new yield fee percentage from vault contract
    /// @param _percentage Percentage of new yield fee
    function setYieldFeePerc(uint256 _percentage) external onlyVault {
        yieldFeePerc = _percentage;
        emit SetYieldFeePerc(_percentage);
    }

    /// @notice Function to set new community wallet from vault contract
    /// @param _communityWallet Address of new community wallet
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

    /// @notice Get total LP token in strategy
    /// @return Total LP token in strategy (18 decimals)
    function getTotalPool() public view returns (uint256) {
        return cvStake.balanceOf(address(this));
    }
}