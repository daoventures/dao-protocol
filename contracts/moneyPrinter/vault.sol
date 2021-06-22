// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";

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
interface IStrategy{
    function deposit(uint _amount, IERC20 _token) external ;
    function harvest() external;
    function withdraw(uint _amount, IERC20 _token) external;
    function getValueInPool() external view returns (uint);
}

/// @title Contract to interact between user and strategy, and distribute daoToken
contract moneyPrinterVault is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    IERC20 public token;
    IERC20 DAI = IERC20(0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063); 
    IERC20 USDC = IERC20(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174);
    IERC20 USDT = IERC20(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);

    IStrategy public strategy;
    address public pendingStrategy;
    address public admin;

    bool public canSetPendingStrategy = true;
    uint256 public unlockTime;
    uint256 public constant LOCKTIME = 2 days;

    event MigrateFunds(
        address indexed fromStrategy,
        address indexed toStrategy,
        uint256 amount
    );

    constructor(address _strategy, address _admin)
        ERC20("DAO Vault Low DAI", "dvlDAI")
    {
        // token = IERC20(_token);
        _setupDecimals(18);
        strategy = IStrategy(_strategy);
        admin = _admin; 

        DAI.safeApprove(_strategy, type(uint).max);
        USDC.safeApprove(_strategy, type(uint).max);
        USDT.safeApprove(_strategy, type(uint).max);
    }

    /**
     * @notice Deposit into strategy
     * @param _amount amount to deposit
     * Requirements:
     * - Only EOA account can call this function
     */
    function deposit(uint256 _amount, IERC20 _token) external {
        require(msg.sender == tx.origin, "Only EOA");
        require(_amount > 0, "Invalid amount");
        uint256 shares;
        if (_token == DAI) {
            
            shares = totalSupply() == 0
                ? _amount
                : _amount.mul(totalSupply()).div(getValueInPool());
            DAI.safeTransferFrom(msg.sender, address(this), _amount);
            
        } else if (_token == USDC) {
            uint _amountMagnified = _amount.mul(1e12);
            shares = totalSupply() == 0
                ? _amountMagnified
                : _amountMagnified.mul(totalSupply()).div(
                    getValueInPool());

            USDC.safeTransferFrom(msg.sender, address(this), _amount);
        } else if (_token == USDT) {
            uint _amountMagnified = _amount.mul(1e12);
            shares = totalSupply() == 0
                ? _amountMagnified
                : _amountMagnified.mul(totalSupply()).div(getValueInPool());
            USDT.safeTransferFrom(msg.sender, address(this), _amount);
        } else {
            revert("Invalid deposit Token");
        }

        strategy.deposit(_amount, _token);
        
        _mint(msg.sender, shares);
        // emit Deposit(msg.sender, address(_token), _amount, shares);
    }

    /**
     * @notice Withdraw from strategy
     * @param _shares shares to withdraw
     * Requirements:
     * - Only EOA account can call this function
     */
    function withdraw(uint256 _shares, IERC20 _token) external {
        require(_shares > 0, "Invalid amount");
        uint256 _totalShares = balanceOf(msg.sender);
        require(_totalShares >= _shares, "Insuffient funds");

        uint amount = getValueInPool().mul(_shares).div(totalSupply());
        console.log('amount', amount);
        strategy.withdraw(amount, _token);
        console.log('balanceInContract', _token.balanceOf(address(this)));
        _token.safeTransfer(msg.sender,  _token.balanceOf(address(this)));
    }

    function harvest() external {
        require(msg.sender == admin, "onlyAdmin");
        strategy.harvest();
    }

    function getValueInPool() public view returns (uint){
        return strategy.getValueInPool();
    }
}
