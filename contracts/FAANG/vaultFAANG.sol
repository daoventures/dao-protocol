pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

interface iStrategy {
    function deposit(uint _amount, address _token) external;

    function getTotalAmountInPool() external view returns (uint256);

    function withdraw(uint256 amount, address token) external;
}

contract FAANGVault is ERC20("DAO FAANG STONKS", "daoFAANG") {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    IERC20 public USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 public USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 public DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);

    iStrategy strategy;

    mapping(address => uint256) depositedAmount;

    address treasuryWallet;
    constructor(address _strategy, address _treasuryWallet) {
        strategy = iStrategy(_strategy);
        treasuryWallet = _treasuryWallet;
    }

    function deposit(uint256 _amount, address _token) external {
        require(_amount > 0);
        uint256 shares;
        uint256 poolBalance = strategy.getTotalAmountInPool(); 

        if (_token == address(DAI)) {
            DAI.safeTransferFrom(msg.sender, address(strategy), _amount);

            shares = totalSupply() == 0
                ? _amount
                : _amount.mul(totalSupply()).div(poolBalance);

            strategy.deposit(_amount, _token);
        } else if (_token == address(USDC)) {
            USDC.safeTransferFrom(msg.sender, address(strategy), _amount);
            shares = totalSupply() == 0
                ? _amount
                : _amount.mul(totalSupply()).div(
                    poolBalance
                );
            strategy.deposit(_amount, _token);
        } else if (_token == address(USDT)) {
            USDT.safeTransferFrom(msg.sender, address(strategy), _amount);
            shares = totalSupply() == 0
                ? _amount
                : _amount.mul(totalSupply()).div(
                    poolBalance
                );
            strategy.deposit(_amount, _token);
        }
        depositedAmount[msg.sender] = depositedAmount[msg.sender].add(_amount);

        _mint(msg.sender, shares);
    }

    function withdraw(uint256 _shares, IERC20 _token) external {
        require(_shares > 0, "Invalid amount");
        uint256 _totalShares = balanceOf(msg.sender);
        require(_totalShares >= _shares, "Insuffient funds");

        uint256 amountDeposited =
            depositedAmount[msg.sender].mul(_shares).div(_totalShares);
        depositedAmount[msg.sender] = depositedAmount[msg.sender].sub(
            amountDeposited
        );

        uint256 amountToWithdraw =
            strategy.getTotalAmountInPool().mul(_shares).div(totalSupply());
        strategy.withdraw(amountToWithdraw, address(_token));

        if (amountToWithdraw > amountDeposited) {
            uint256 _profit = amountToWithdraw.sub(amountDeposited);
            uint256 _fee = _profit.mul(20).div(100); //20% fee
            amountToWithdraw = amountToWithdraw.sub(_fee);
            _token.safeTransfer(treasuryWallet, _fee);
        }

        _burn(msg.sender, _shares);
        _token.safeTransfer(msg.sender, amountToWithdraw);
        
    }

}
