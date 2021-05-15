// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "../../libraries/Ownable.sol";

/**
 * New strategy contract must have functions below:
 *
 * Global variable pool
 *
 * function deposit(uint256 _amount)
 * -> require msg.sender == Vault
 *
 * function withdraw(uint256 _amount)
 * -> require msg.sender == Vault
 *
 * function refund(uint256 _shares)
 * -> Receive amount of shares (same amount with daoToken) as argument
 * -> require msg.sender == Vault
 *
 * function approveMigrate()
 * -> Approve Vault to migrate all funds to new strategy
 */
import "../../interfaces/IStrategy2.sol";

/// @title Contract to interact between user and strategy, and distribute daoToken
contract DAOVault is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint256;

    bytes32 public vaultName;
    IERC20Upgradeable public token;
    uint256 private _fees;
    IStrategy2 public strategy;
    address public pendingStrategy;

    bool public canSetPendingStrategy;
    uint256 public unlockTime;

    // Calculation for fees
    uint256[] public networkFeeTier2;
    uint256 public customNetworkFeeTier;
    uint256[] public networkFeePercentage;
    uint256 public customNetworkFeePercentage;

    // Address to collect fees
    address public treasuryWallet;
    address public communityWallet;

    event SetNetworkFeeTier2(
        uint256[] oldNetworkFeeTier2,
        uint256[] newNetworkFeeTier2
    );
    event SetNetworkFeePercentage(
        uint256[] oldNetworkFeePercentage,
        uint256[] newNetworkFeePercentage
    );
    event SetCustomNetworkFeeTier(
        uint256 indexed oldCustomNetworkFeeTier,
        uint256 indexed newCustomNetworkFeeTier
    );
    event SetCustomNetworkFeePercentage(
        uint256 oldCustomNetworkFeePercentage,
        uint256 newCustomNetworkFeePercentage
    );
    event SetTreasuryWallet(
        address indexed oldTreasuryWallet,
        address indexed newTreasuryWallet
    );
    event SetCommunityWallet(
        address indexed oldCommunityWallet,
        address indexed newCommunityWallet
    );
    event MigrateFunds(
        address indexed fromStrategy,
        address indexed toStrategy,
        uint256 amount
    );

    modifier onlyEOA {
        require(msg.sender == tx.origin, "Only EOA");
        _;
    }

    /**
     * @notice Replace constructor function in clone contract
     * @dev modifier initializer: only allow run this function once
     * @param _vaultName Name of this vault contract
     * @param _token Token that vault accept and interact with strategy
     * @param _strategy Strategy contract that vault interact with
     * @param _owner Owner of this vault contract
     */
    function init(
        bytes32 _vaultName,
        address _token,
        address _strategy,
        address _owner
    ) external initializer {
        __ERC20_init("DAO Vault", "DAOVault");
        __Ownable_init(_owner);

        vaultName = _vaultName;
        token = IERC20Upgradeable(_token);
        strategy = IStrategy2(_strategy);

        canSetPendingStrategy = true;
        uint8 decimals = ERC20Upgradeable(_token).decimals();
        networkFeeTier2 = [50000 * 10**decimals + 1, 100000 * 10**decimals];
        customNetworkFeeTier = 1000000 * 10**decimals;
        networkFeePercentage = [100, 75, 50];
        customNetworkFeePercentage = 25;
        treasuryWallet = 0x59E83877bD248cBFe392dbB5A8a29959bcb48592;
        communityWallet = 0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0;

        token.safeApprove(address(strategy), type(uint256).max);
    }

    /**
     * @notice Deposit into strategy
     * @param _amount amount to deposit
     * Requirements:
     * - Sender must approve this contract to transfer token from sender to this contract
     * - Only EOA account can call this function
     */
    function deposit(uint256 _amount) external onlyEOA {
        require(_amount > 0, "Amount must > 0");

        uint256 _pool = strategy.pool().add(token.balanceOf(address(this))).sub(_fees);
        token.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 _networkFeePercentage;
        /**
         * Network fees
         * networkFeeTier2 is used to set each tier minimun and maximun
         * For example networkFeeTier2 is [50000, 100000],
         * Tier 1 = _depositAmount < 50001
         * Tier 2 = 50001 <= _depositAmount <= 100000
         * Tier 3 = _depositAmount > 100000
         *
         * networkFeePercentage is used to set each tier network fee percentage
         * For example networkFeePercentage is [100, 75, 50]
         * which mean network fee for Tier 1 = 1%, Tier 2 = 0.75%, Tier 3 = 0.5%
         *
         * customNetworkFeeTier is treat as tier 4
         * customNetworkFeePercentage will be used in customNetworkFeeTier
         */
        if (_amount < networkFeeTier2[0]) {
            // Tier 1
            _networkFeePercentage = networkFeePercentage[0];
        } else if (_amount <= networkFeeTier2[1]) {
            // Tier 2
            _networkFeePercentage = networkFeePercentage[1];
        } else if (_amount < customNetworkFeeTier) {
            // Tier 3
            _networkFeePercentage = networkFeePercentage[2];
        } else {
            // Custom Tier
            _networkFeePercentage = customNetworkFeePercentage;
        }
        uint256 _fee = _amount.mul(_networkFeePercentage).div(10000 /*DENOMINATOR*/);
        _amount = _amount.sub(_fee);
        _fees = _fees.add(_fee);

        uint256 _shares = totalSupply() == 0
            ? _amount
            : _amount.mul(totalSupply()).div(_pool);
        _mint(msg.sender, _shares);
    }

    /**
     * @notice Withdraw from strategy
     * @param _shares shares to withdraw
     * Requirements:
     * - Only EOA account can call this function
     */
    function withdraw(uint256 _shares) external onlyEOA {
        uint256 _balanceOfVault = (token.balanceOf(address(this))).sub(_fees);
        uint256 _withdrawAmt = (_balanceOfVault.add(strategy.pool()).mul(_shares).div(totalSupply()));

        // USDT.transfer don't check if amount is 0. Therefor we will check it here.
        require(0 < _withdrawAmt, "Amount must > 0");

        if (_withdrawAmt > _balanceOfVault) {
            uint256 _diff = strategy.withdraw(_withdrawAmt.sub(_balanceOfVault));
            token.safeTransfer(msg.sender, _balanceOfVault.add(_diff));
        } else {
            token.safeTransfer(msg.sender, _withdrawAmt);
        }
        _burn(msg.sender, _shares);
    }

    /**
     * @notice Refund from strategy
     * @notice This function usually only available when strategy in vesting state
     * Requirements:
     * - Only EOA account can call this function
     * - Amount daoToken of user must greater than 0
     */
    function refund() external onlyEOA {
        require(balanceOf(msg.sender) > 0, "No balance to refund");

        uint256 _shares = balanceOf(msg.sender);
        strategy.refund(_shares);
        _burn(msg.sender, _shares);
    }

    function invest() external onlyOwner {
        if (_fees > 0) {
            uint256 treasuryFee = _fees.div(2);
            token.safeTransfer(treasuryWallet, treasuryFee);
            token.safeTransfer(communityWallet, _fees.sub(treasuryFee));
            _fees = 0;
        }

        uint256 _toInvest = token.balanceOf(address(this));
        if (_toInvest > 0) {
            strategy.deposit(_toInvest);
        }

        strategy.invest();
    }

    /**
     * @notice Set network fee tier
     * @notice Details for network fee tier can view at deposit() function above
     * @param _networkFeeTier2  Array [tier2 minimun, tier2 maximun], view additional info below
     * Requirements:
     * - Only owner of this contract can call this function
     * - First element in array must greater than 0
     * - Second element must greater than first element
     */
    function setNetworkFeeTier2(uint256[] calldata _networkFeeTier2)
        external
        onlyOwner
    {
        require(_networkFeeTier2[0] != 0, "Minimun amount cannot be 0");
        require(
            _networkFeeTier2[1] > _networkFeeTier2[0],
            "Maximun amount must greater than minimun amount"
        );
        /**
         * Network fees have three tier, but it is sufficient to have minimun and maximun amount of tier 2
         * Tier 1: deposit amount < minimun amount of tier 2
         * Tier 2: minimun amount of tier 2 <= deposit amount <= maximun amount of tier 2
         * Tier 3: amount > maximun amount of tier 2
         */
        uint256[] memory oldNetworkFeeTier2 = networkFeeTier2;
        networkFeeTier2 = _networkFeeTier2;
        emit SetNetworkFeeTier2(oldNetworkFeeTier2, _networkFeeTier2);
    }

    /**
     * @notice Set custom network fee tier
     * @param _customNetworkFeeTier Integar
     * Requirements:
     * - Only owner of this contract can call this function
     * - Custom network fee tier must greater than maximun amount of network fee tier 2
     */
    function setCustomNetworkFeeTier(uint256 _customNetworkFeeTier)
        external
        onlyOwner
    {
        require(
            _customNetworkFeeTier > networkFeeTier2[1],
            "Custom network fee tier must greater than tier 2"
        );

        uint256 oldCustomNetworkFeeTier = customNetworkFeeTier;
        customNetworkFeeTier = _customNetworkFeeTier;
        emit SetCustomNetworkFeeTier(
            oldCustomNetworkFeeTier,
            _customNetworkFeeTier
        );
    }

    /**
     * @notice Set network fee in percentage
     * @notice Details for network fee percentage can view at deposit() function above
     * @param _networkFeePercentage An array of integer, view additional info below
     * Requirements:
     * - Only owner of this contract can call this function
     * - Each of the element in the array must less than 3000 (30%)
     */
    function setNetworkFeePercentage(uint256[] calldata _networkFeePercentage)
        external
        onlyOwner
    {
        require(
            _networkFeePercentage[0] < 3000 &&
                _networkFeePercentage[1] < 3000 &&
                _networkFeePercentage[2] < 3000,
            "Network fee percentage cannot be more than 30%"
        );
        /**
         * _networkFeePercentage content a array of 3 element, representing network fee of tier 1, tier 2 and tier 3
         * For example networkFeePercentage is [100, 75, 50]
         * which mean network fee for Tier 1 = 1%, Tier 2 = 0.75% and Tier 3 = 0.5%
         */
        uint256[] memory oldNetworkFeePercentage = networkFeePercentage;
        networkFeePercentage = _networkFeePercentage;
        emit SetNetworkFeePercentage(
            oldNetworkFeePercentage,
            _networkFeePercentage
        );
    }

    /**
     * @notice Set custom network fee percentage
     * @param _percentage Integar (100 = 1%)
     * Requirements:
     * - Only owner of this contract can call this function
     * - Amount set must less than network fee for tier 3
     */
    function setCustomNetworkFeePercentage(uint256 _percentage)
        public
        onlyOwner
    {
        require(
            _percentage < networkFeePercentage[2],
            "Custom network fee percentage cannot be more than tier 2"
        );

        uint256 oldCustomNetworkFeePercentage = customNetworkFeePercentage;
        customNetworkFeePercentage = _percentage;
        emit SetCustomNetworkFeePercentage(
            oldCustomNetworkFeePercentage,
            _percentage
        );
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
     * @notice Set pending strategy
     * @param _pendingStrategy Address of pending strategy
     * Requirements:
     * - Only owner of this contract call this function
     * - Pending strategy must be a contract
     */
    function setPendingStrategy(address _pendingStrategy) external onlyOwner {
        require(canSetPendingStrategy, "Cannot set pending strategy now");
        require(_pendingStrategy.isContract(), "New strategy is not contract");

        pendingStrategy = _pendingStrategy;
    }

    /**
     * @notice Unlock function migrateFunds()
     * Requirements:
     * - Only owner of this contract call this function
     */
    function unlockMigrateFunds() external onlyOwner {
        unlockTime = block.timestamp.add(2 days /*LOCKTIME*/);
        canSetPendingStrategy = false;
    }

    /**
     * @notice Migrate all funds from old strategy to new strategy
     * Requirements:
     * - Only owner of this contract call this function
     * - This contract is not locked
     * - Pending strategy is set
     */
    function migrateFunds() external onlyOwner {
        require(
            unlockTime <= block.timestamp &&
                unlockTime.add(1 days) >= block.timestamp,
            "Function locked"
        );
        require(
            token.balanceOf(address(strategy)) > 0,
            "No balance to migrate"
        );
        require(pendingStrategy != address(0), "No pendingStrategy");
        uint256 _amount = token.balanceOf(address(strategy));

        token.safeTransferFrom(address(strategy), pendingStrategy, _amount);

        // Set new strategy
        address oldStrategy = address(strategy);
        strategy = IStrategy2(pendingStrategy);
        pendingStrategy = address(0);
        canSetPendingStrategy = true;

        token.safeApprove(address(oldStrategy), 0);
        token.safeApprove(address(strategy), type(uint256).max);

        unlockTime = 0; // Lock back this function
        emit MigrateFunds(oldStrategy, address(strategy), _amount);
    }
}
