// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * New strategy contract must utilize ERC20 and with functions below:
 *
 * In constructor, _setupDecimals(decimals) follow token decimals
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
import "../../interfaces/IStrategy.sol";

/// @title Contract to interact between user and strategy, and distribute daoToken
contract DAOVaultLowUSDT is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    IERC20 public token;
    IStrategy public strategy;
    address public pendingStrategy;

    bool public canSetPendingStrategy = true;
    uint256 public unlockTime;
    uint256 public constant LOCKTIME = 2 days;

    event MigrateFunds(
        address indexed fromStrategy,
        address indexed toStrategy,
        uint256 amount
    );

    constructor(address _token, address _strategy)
        ERC20("DAO Vault Low USDT", "dvlUSDT")
    {
        token = IERC20(_token);
        _setupDecimals(6);
        strategy = IStrategy(_strategy);
    }

    /**
     * @notice Deposit into strategy
     * @param _amount amount to deposit
     * Requirements:
     * - Only EOA account can call this function
     */
    function deposit(uint256 _amount) external {
        require(address(msg.sender).isContract() == false, "Only EOA");
        require(_amount > 0, "Amount must > 0");

        uint256 _before = strategy.balanceOf(address(this));
        strategy.deposit(_amount);
        uint256 _after = strategy.balanceOf(address(this));
        uint256 _shares = _after.sub(_before);
        _mint(msg.sender, _shares);
    }

    /**
     * @notice Withdraw from strategy
     * @param _amount shares to withdraw
     * Requirements:
     * - Only EOA account can call this function
     */
    function withdraw(uint256 _amount) external {
        require(address(msg.sender).isContract() == false, "Only EOA");
        require(_amount > 0, "Amount must > 0");

        uint256 _before = strategy.balanceOf(address(this));
        strategy.withdraw(_amount);
        uint256 _after = strategy.balanceOf(address(this));
        _burn(msg.sender, _before.sub(_after));
    }

    /**
     * @notice Refund from strategy
     * @notice This function usually only available when strategy in vesting state
     * Requirements:
     * - Only EOA account can call this function
     * - Amount daoToken of user must greater than 0
     */
    function refund() external {
        require(address(msg.sender).isContract() == false, "Only EOA");
        require(balanceOf(msg.sender) > 0, "No balance to refund");

        uint256 _shares = balanceOf(msg.sender);
        uint256 _before = strategy.balanceOf(address(this));
        strategy.refund(_shares);
        uint256 _after = strategy.balanceOf(address(this));
        _burn(msg.sender, _before.sub(_after));
    }

    /**
     * @notice Set pending strategy
     * @param _pendingStrategy Address of pending strategy
     * Requirements:
     * - Only owner of this contract call this function
     * - Pending strategy must be a contract
     */
    function setPendingStrategy(address _pendingStrategy) external onlyOwner {
        require(
            canSetPendingStrategy == true,
            "Cannot set pending strategy now"
        );
        require(
            _pendingStrategy.isContract() == true,
            "New strategy is not contract"
        );

        pendingStrategy = _pendingStrategy;
    }

    /**
     * @notice Unlock function migrateFunds()
     * Requirements:
     * - Only owner of this contract call this function
     */
    function unlockMigrateFunds() external onlyOwner {
        unlockTime = block.timestamp + LOCKTIME;
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
                unlockTime + 1 days >= block.timestamp,
            "Function locked"
        );
        require(
            token.balanceOf(address(strategy)) > 0,
            "No balance to migrate"
        );
        require(pendingStrategy != address(0), "No pendingStrategy");
        uint256 _amount = token.balanceOf(address(strategy));

        token.safeTransferFrom(address(strategy), pendingStrategy, _amount);
        // Remove balance of old strategy token
        IERC20 oldStrategyToken = IERC20(address(strategy));
        oldStrategyToken.safeTransfer(
            address(strategy),
            oldStrategyToken.balanceOf(address(this))
        );

        // Set new strategy
        address oldStrategy = address(strategy);
        strategy = IStrategy(pendingStrategy);
        pendingStrategy = address(0);
        canSetPendingStrategy = true;

        unlockTime = 0; // Lock back this function
        emit MigrateFunds(oldStrategy, address(strategy), _amount);
    }
}
