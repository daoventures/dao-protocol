// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "../../libraries/Ownable.sol";

import "../../interfaces/IHFVault.sol";
import "../../interfaces/IHFStake.sol";
import "../../interfaces/IDAOVault.sol";
import "../../interfaces/IFARM.sol";
import "../../interfaces/IUniswapV2Router02.sol";

import "hardhat/console.sol";

/// @title Contract for yield token with Harvest Finance and utilize FARM token
contract HarvestFarmer is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IHFVault;
    using SafeERC20Upgradeable for IFARM;
    using SafeMathUpgradeable for uint256;

    bytes32 public strategyName;
    IERC20Upgradeable public token;
    IDAOVault public daoVault;
    IHFVault public hfVault;
    IHFStake public hfStake;
    IFARM public FARM;
    IUniswapV2Router02 public uniswapRouter;
    address public WETH;
    uint256 private constant MAX_UNIT = 2**256 - 2;
    bool public isVesting;
    uint256 public pool;

    // For Uniswap
    uint256 public amountOutMinPerc;
    uint256 public deadline;

    // Address to collect fees
    address public treasuryWallet;
    address public communityWallet;

    uint256 public constant DENOMINATOR = 10000;
    uint256 public profileSharingFeePercentage;
    uint256 public constant treasuryFee = 5000; // 50% on profile sharing fee
    uint256 public constant communityFee = 5000; // 50% on profile sharing fee

    event SetTreasuryWallet(address indexed oldTreasuryWallet, address indexed newTreasuryWallet);
    event SetCommunityWallet(address indexed oldCommunityWallet, address indexed newCommunityWallet);
    event SetProfileSharingFeePercentage(
        uint256 indexed oldProfileSharingFeePercentage, uint256 indexed newProfileSharingFeePercentage);

    modifier notVesting {
        require(!isVesting, "Contract in vesting state");
        _;
    }

    modifier onlyVault {
        require(msg.sender == address(daoVault), "Only can call from Vault");
        _;
    }

    function init(
        bytes32 _strategyName, address _token, address _hfVault, address _hfStake, address _FARM, address _uniswapRouter, address _WETH, address _owner
    ) external initializer {
        __Ownable_init(_owner);

        strategyName = _strategyName;
        token = IERC20Upgradeable(_token);
        hfVault = IHFVault(_hfVault);
        hfStake = IHFStake(_hfStake);
        FARM = IFARM(_FARM);
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        WETH = _WETH;

        amountOutMinPerc = 9500;
        deadline = 20 minutes;
        treasuryWallet = 0x59E83877bD248cBFe392dbB5A8a29959bcb48592;
        communityWallet = 0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0;
        profileSharingFeePercentage = 1000;
        
        token.safeApprove(address(hfVault), MAX_UNIT);
        hfVault.safeApprove(address(hfStake), MAX_UNIT);
    }

    /**
     * @notice Set Vault that interact with this contract
     * @dev This function call after deploy Vault contract and only able to call once
     * @dev This function is needed only if this is the first strategy to connect with Vault
     * @param _address Address of Vault
     * Requirements:
     * - Only owner of this contract can call this function
     * - Vault is not set yet
     */
    function setVault(address _address) external onlyOwner {
        require(address(daoVault) == address(0), "Vault set");

        daoVault = IDAOVault(_address);
    }

    /**
     * @notice Set new treasury wallet address in contract
     * @param _treasuryWallet Address of new treasury wallet
     * Requirements:
     * - Only owner of this contract can call this function
     */
    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        address oldTreasuryWallet = treasuryWallet;
        treasuryWallet = _treasuryWallet;
        emit SetTreasuryWallet(oldTreasuryWallet, _treasuryWallet);
    }

    /**
     * @notice Set new community wallet address in contract
     * @param _communityWallet Address of new community wallet
     * Requirements:
     * - Only owner of this contract can call this function
     */
    function setCommunityWallet(address _communityWallet) external onlyOwner {
        address oldCommunityWallet = communityWallet;
        communityWallet = _communityWallet;
        emit SetCommunityWallet(oldCommunityWallet, _communityWallet);
    }

    /**
     * @notice Set profile sharing fee
     * @param _percentage Integar (100 = 1%)
     * Requirements:
     * - Only owner of this contract can call this function
     * - Amount set must less than 3000 (30%)
     */
    function setProfileSharingFeePercentage(uint256 _percentage) public onlyOwner {
        require(_percentage < 3000, "Profile sharing fee percentage cannot be more than 30%");

        uint256 oldProfileSharingFeePercentage = profileSharingFeePercentage;
        profileSharingFeePercentage = _percentage;
        emit SetProfileSharingFeePercentage(oldProfileSharingFeePercentage, _percentage);
    }

    /**
     * @notice Set amount out minimum percentage for swap COMP token in Uniswap
     * @param _percentage Integar (100 = 1%)
     * Requirements:
     * - Only owner of this contract can call this function
     * - Percentage set must less than or equal 9700 (97%)
     */
    function setAmountOutMinPerc(uint256 _percentage) external onlyOwner {
        require(_percentage <= 9700, "Amount out minimun > 97%");

        amountOutMinPerc = _percentage;
    }

    /**
     * @notice Set deadline for swap COMP token in Uniswap
     * @param _seconds Integar
     * Requirements:
     * - Only owner of this contract can call this function
     * - Deadline set must greater than or equal 60 seconds
     */
    function setDeadline(uint256 _seconds) external onlyOwner {
        require(_seconds >= 60, "Deadline < 60 seconds");

        deadline = _seconds;
    }

    /**
     * @notice Deposit token into Harvest Finance Vault
     * @param _amount Amount of token to deposit
     * Requirements:
     * - This contract is not in vesting state
     * - Only Vault can call this function
     */
    function deposit(uint256 _amount) external onlyVault notVesting {
        token.safeTransferFrom(msg.sender, address(this), _amount);
        hfVault.deposit(_amount);
        pool = pool.add(_amount);

        // Staking fToken to get FARM token
        hfStake.stake(hfVault.balanceOf(address(this)));
    }

    /**
     * @notice Withdraw token from Harvest Finance Vault, exchange distributed FARM token to token same as deposit token
     * @param _amount amount of token to withdraw
     * Requirements:
     * - This contract is not in vesting state
     * - Only Vault can call this function
     * - Amount of withdraw must lesser than or equal to amount of deposit
     */
    function withdraw(uint256 _amount) external onlyVault notVesting {
        // Claim distributed FARM token and calculate sender portion
        hfStake.getReward();
        uint256 _portionFARM = FARM.balanceOf(address(this)).mul(_amount).div(pool);

        // Swap FARM token for token same as deposit token
        if (_portionFARM > 0) {
            uint256 _amountIn = _portionFARM;
            FARM.safeIncreaseAllowance(address(uniswapRouter), _amountIn);

            address[] memory _path = new address[](3);
            _path[0] = address(FARM);
            _path[1] = WETH;
            _path[2] = address(token);

            uint256[] memory _amountsOut = uniswapRouter.getAmountsOut(_amountIn, _path);
            if (_amountsOut[2] > 0) {
                uint256 _amountOutMin = _amountsOut[2].mul(amountOutMinPerc).div(DENOMINATOR);
                uniswapRouter.swapExactTokensForTokens(
                    _amountIn, _amountOutMin, _path, address(this), block.timestamp.add(deadline));
            }
        }

        // Withdraw from Harvest Finance Stake contract and Vault contract
        uint256 _fTokenBalance = (hfStake.balanceOf(address(this))).mul(_amount).div(pool);
        hfStake.withdraw(_fTokenBalance);
        hfVault.withdraw(hfVault.balanceOf(address(this)));

        uint256 _r = token.balanceOf(address(this));
        if (_r > _amount) {
            uint256 _p = _r.sub(_amount);
            uint256 _fee = _p.mul(profileSharingFeePercentage).div(DENOMINATOR);
            token.safeTransfer(tx.origin, _r.sub(_fee));
            token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
            token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
        } else {
            token.safeTransfer(tx.origin, _r);
        }

        pool = pool.sub(_amount);
    }

    /**
     * @notice Vesting this contract, withdraw all token from Compound and claim all distributed COMP token
     * @notice Disabled the deposit and withdraw functions for public, only allowed users to do refund from this contract
     * Requirements:
     * - Only owner of this contract can call this function
     * - This contract is not in vesting state
     */
    function vesting() external onlyOwner notVesting {
        // Claim all distributed FARM token
        // and withdraw all fToken from Harvest Finance Stake contract
        if (hfStake.balanceOf(address(this)) > 0) {
            hfStake.exit();
        }

        // Withdraw all token from Harvest Finance Vault contract
        uint256 _fTokenBalance = hfVault.balanceOf(address(this));
        if (_fTokenBalance > 0) {
            hfVault.withdraw(_fTokenBalance);
        }

        // Swap all FARM token for token same as deposit token
        uint256 _FARMBalance = FARM.balanceOf(address(this));
        if (_FARMBalance > 0) {
            uint256 _amountIn = _FARMBalance;
            FARM.safeIncreaseAllowance(address(uniswapRouter), _amountIn);

            address[] memory _path = new address[](3);
            _path[0] = address(FARM);
            _path[1] = WETH;
            _path[2] = address(token);

            uint256[] memory _amountsOut = uniswapRouter.getAmountsOut(_amountIn, _path);
            if (_amountsOut[2] > 0) {
                uint256 _amountOutMin = _amountsOut[2].mul(amountOutMinPerc).div(DENOMINATOR);
                uniswapRouter.swapExactTokensForTokens(
                    _amountIn, _amountOutMin, _path, address(this), block.timestamp.add(deadline));
            }
        }

        // Collect all fees
        uint256 _allTokenBalance = token.balanceOf(address(this));
        if (_allTokenBalance > pool) {
            uint256 _profit = _allTokenBalance.sub(pool);
            uint256 _fee = _profit.mul(profileSharingFeePercentage).div(DENOMINATOR);
            token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
            token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
        }

        pool = token.balanceOf(address(this));
        isVesting = true;
    }

    /**
     * @notice Refund all token including profit based on daoToken hold by sender
     * @notice Only available after contract in vesting state
     * Requirements:
     * - This contract is in vesting state
     * - Only Vault can call this function
     */
    function refund(uint256 _shares) external onlyVault {
        require(isVesting, "Not in vesting state");

        uint256 _refundAmount = pool.mul(_shares).div(daoVault.totalSupply());
        token.safeTransfer(tx.origin, _refundAmount);
        pool = pool.sub(_refundAmount);
    }

    /**
     * @notice Revert this contract to normal from vesting state
     * Requirements:
     * - Only owner of this contract can call this function
     * - This contract is in vesting state
     */
    function revertVesting() public onlyOwner {
        require(isVesting, "Not in vesting state");

        // Re-deposit all token to Harvest Finance Vault contract
        // and re-stake all fToken to Harvest Finance Stake contract
        uint256 _amount = token.balanceOf(address(this));
        if (_amount > 0) {
            hfVault.deposit(_amount);
            hfStake.stake(hfVault.balanceOf(address(this)));
        }

        isVesting = false;
    }

    /**
     * @notice Approve Vault to migrate funds from this contract
     * Requirements:
     * - Only owner of this contract can call this function
     * - This contract is in vesting state
     */
    function approveMigrate() external onlyOwner {
        require(isVesting, "Not in vesting state");

        if (token.allowance(address(this), address(daoVault)) == 0) {
            token.safeApprove(address(daoVault), MAX_UNIT);
        }
    }

    function reuseContract() external onlyOwner {
        pool = token.balanceOf(address(this));
        revertVesting();
    }
}
