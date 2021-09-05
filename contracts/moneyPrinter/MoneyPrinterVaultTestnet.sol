// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IUniswapV2Router02.sol";
import "../../libs/BaseRelayRecipient.sol";


interface IStrategy{
    function deposit(uint _amount, IERC20 _token) external ;
    function harvest() external;
    function withdraw(uint _amount, IERC20 _token) external;
    function getValueInPool() external view returns (uint);
    function migrateFunds(IERC20 _withdrawnToken) external ;
    function setVault(address _vault) external ;
    function setTreasuryWallet(address _newTreasury) external;
}


contract MoneyPrinterVaultTestnet is ERC20, Ownable, BaseRelayRecipient {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    IERC20 public DAI = IERC20(0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F); 
    IERC20 public USDC = IERC20(0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e);
    IERC20 public USDT = IERC20(0xBD21A10F619BE90d6066c941b04e340841F1F989);
    IERC20 emergencyWithdrawToken; //Tokens are converted to `emergencyWithdrawToken` durin emergency withdraw
    IUniswapV2Router02 public constant QuickSwapRouter = IUniswapV2Router02(0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff);
    IStrategy public strategy;
    address public pendingStrategy;
    address public admin;
    address public treasuryWallet ; 
    address public communityWallet ;
    address public strategist ;
    
    bool public canSetPendingStrategy = true;
    bool public isEmergency = false;

    uint256 public unlockTime;
    uint256 public constant LOCKTIME = 2 days;
    uint256[] public networkFeeTier2 = [50000*1e18+1, 100000*1e18];
    uint256 public customNetworkFeeTier = 1000000*1e18;
    uint256[] public networkFeePerc = [100, 75, 50];
    uint256 public customNetworkFeePerc = 25;
    uint256 public profitSharingFeePerc = 2000;

    mapping(address => uint) public depositedAmount;


    event Deposit(address indexed from, address indexed token, uint amount, uint sharesMinted);
    event Withdraw(address indexed from, address indexed token, uint amount, uint sharesBurned);
    event MigrateFunds(address indexed fromStrategy, address indexed newStrategy, uint amount);
    event SetAdmin(address oldAdmin, address newAdmin);
    event SetCommunityWallet(address oldCommunityWallet, address newCommunityWallet);
    event SetTreasuryWallet(address oldTreasury, address newTreasury);
    event SetPendingStrategy(address oldStrategy, address newStrategy);
    event Yield(uint timestamp);
    event UnlockMigrateFunds(uint unlockTime);
    event SetStrategistWallet(address oldStrategist, address newStrategist);

    constructor(address _strategy, address _admin, address _treasuryWallet, address _communityWallet, address _strategist, address _biconomy)
        ERC20("DAO Vault Money Printer", "daoMPT")
    {
        _setupDecimals(18);
        strategy = IStrategy(_strategy);
        admin = _admin; 
        trustedForwarder = _biconomy;

        treasuryWallet = _treasuryWallet;
        communityWallet = _communityWallet;
        strategist = _strategist;

        DAI.safeApprove(_strategy, type(uint).max);
        USDC.safeApprove(_strategy, type(uint).max);
        USDT.safeApprove(_strategy, type(uint).max);

/*         DAI.safeApprove(address(QuickSwapRouter), type(uint).max);
        USDC.safeApprove(address(QuickSwapRouter), type(uint).max);
        USDT.safeApprove(address(QuickSwapRouter), type(uint).max); */
    }

    modifier onlyAdmin {
        require(msg.sender == admin, "Only Admin");
        _;
    }

        /// @notice Function that required for inherict BaseRelayRecipient
    function _msgSender() internal override(Context, BaseRelayRecipient) view returns (address payable) {
        return BaseRelayRecipient._msgSender();
    }
    
    /// @notice Function that required for inherict BaseRelayRecipient
    function versionRecipient() external pure override returns (string memory) {
        return "1";
    }

    /**
     * @notice Deposit into strategy
     * @param _amount amount to deposit
     * Requirements:
     * - Only EOA account can call this function
     */
    function deposit(uint256 _amount, IERC20 _token) external {
        require(msg.sender == tx.origin || isTrustedForwarder(msg.sender), "Only EOA");
        require(isEmergency == false ,"Cannot deposit during emergency");
        require(_amount > 0, "Invalid amount");

        address _sender = _msgSender();

        uint256 shares;
        uint feeAmount;
        uint _amountAfterFee;
        if (_token == DAI) {
            (_amountAfterFee, feeAmount) = _calcSharesAfterNetworkFee(_amount);

            shares = totalSupply() == 0
                ? _amountAfterFee
                : _amountAfterFee.mul(totalSupply()).div(getValueInPool());

            DAI.safeTransferFrom(_sender, address(this), _amount);
            depositedAmount[_sender] = depositedAmount[_sender].add(_amountAfterFee);
        } else if (_token == USDC) {
            uint _amountMagnified = _amount.mul(1e12);
            (_amountAfterFee, feeAmount) = _calcSharesAfterNetworkFee(_amountMagnified);

            shares = totalSupply() == 0
                ? _amountAfterFee
                : _amountAfterFee.mul(totalSupply()).div(
                    getValueInPool());

            USDC.safeTransferFrom(_sender, address(this), _amount);
            
            depositedAmount[_sender] = depositedAmount[_sender].add(_amountAfterFee);
            feeAmount = feeAmount.div(1e12);
        } else if (_token == USDT) {
            uint _amountMagnified = _amount.mul(1e12);
            (_amountAfterFee, feeAmount) = _calcSharesAfterNetworkFee(_amountMagnified);

            shares = totalSupply() == 0
                ? _amountAfterFee
                : _amountAfterFee.mul(totalSupply()).div(getValueInPool());
            USDT.safeTransferFrom(_sender, address(this), _amount);

            depositedAmount[_sender] = depositedAmount[_sender].add(_amountAfterFee);
            feeAmount = feeAmount.div(1e12);
        } else {
            revert("Invalid deposit Token");
        }

        transferNetworkFee(feeAmount, _token);

        // strategy.deposit(_amount.sub(feeAmount), _token);
        
        _mint(_sender, shares);
        emit Deposit(_sender, address(_token), _amount, shares);
    }

    /**
     * @notice Withdraw from strategy
     * @param _shares shares to withdraw
     * Requirements:
     * - Only EOA account can call this function
     */
    function withdraw(uint256 _shares, IERC20 _token) external {
        require(msg.sender == tx.origin, "Only EOA");
        require(_token == DAI || _token == USDC || _token == USDT, "Invalid token");
        require(_shares > 0, "Invalid amount");
        uint256 _totalShares = balanceOf(msg.sender);
        require(_totalShares >= _shares, "Insuffient funds");
        uint _fee;
        uint amountToWithdraw;

        uint amount = getValueInPool().mul(_shares).div(totalSupply());
        uint _depositedAmount = depositedAmount[msg.sender].mul(_shares).div(_totalShares);
        depositedAmount[msg.sender] = depositedAmount[msg.sender].sub(_depositedAmount);

        
        if(amount > _depositedAmount) {
            uint256 _profit = amount.sub(_depositedAmount);
            _fee = _profit.mul(profitSharingFeePerc).div(10000);
            
            _fee = _token == DAI ? _fee : _fee.div(1e12);
        }

        if(isEmergency) {
            //conver to user's token
            if(_token != emergencyWithdrawToken) {
                address[] memory path = new address[](2);
                path[0] = address(emergencyWithdrawToken);
                path[1] = address(_token);
                uint[] memory amounts = QuickSwapRouter.swapExactTokensForTokens(_token == DAI ? amount : amount.div(1e12), 0, path, address(this), block.timestamp);  
                amountToWithdraw = amounts[1].sub(_fee);
            } else {
                //emergency token and user token are same, subtract the fee(if any) and withdraw.
                amountToWithdraw = _token == DAI ? amount.sub(_fee) : amount.sub(_fee).div(1e12); 
            }

        } else {
            //not emergency - withdraw from strategy
            // strategy.withdraw(amount, _token);
            amountToWithdraw = _token.balanceOf(address(this)).sub(_fee);
        }
        

        if(_fee != 0) {
            _token.safeTransfer(treasuryWallet, _fee);
        }

        _token.safeTransfer(msg.sender,  amountToWithdraw);

        _burn(msg.sender, _shares);
        emit Withdraw(msg.sender, address(_token), amountToWithdraw, _shares);
    }

    function yield() external onlyAdmin{
        require(isEmergency == false, "Cannot call during emergency");
        strategy.harvest();

        emit Yield(block.timestamp);
    }

    function emergencyWithdraw(IERC20 _token) external onlyAdmin {
        isEmergency = true;
        emergencyWithdrawToken = _token;
        strategy.migrateFunds(_token);
    }

    function reInvest() external onlyOwner {
        isEmergency = false; 

        uint daiBalance = DAI.balanceOf(address(this));
        uint usdcBalance = USDC.balanceOf(address(this));
        uint usdtBalance = USDT.balanceOf(address(this));

        if(daiBalance > 0) {
            strategy.deposit(daiBalance, DAI);
        }

        if(usdcBalance > 0) {
            strategy.deposit(usdcBalance, USDC);
        }

        if(usdtBalance > 0) {
            strategy.deposit(usdtBalance, USDT);
        }
    }

    function setPendingStrategy(address _pendingStrategy) external onlyOwner {
        require(canSetPendingStrategy, "Cannot set strategy");
        require(_pendingStrategy != address(0), "Invalid strategy address");

        address oldStrategy = address(strategy);
        pendingStrategy = _pendingStrategy;
        emit SetPendingStrategy(oldStrategy, _pendingStrategy);
    }

    function unlockMigrateFunds() external onlyOwner{
        unlockTime = block.timestamp.add(LOCKTIME);
        canSetPendingStrategy = false;
        emit UnlockMigrateFunds(unlockTime);
    }

    function migrateFunds(IERC20 _token) external onlyOwner{
        require(unlockTime <= block.timestamp && unlockTime.add(1 days) >= block.timestamp, "Function locked");
        require(isEmergency == false, "Cannot call during emergency");
        
        address oldStrategy = address(strategy);

        strategy.migrateFunds(_token);
        uint amount = _token.balanceOf(address(this));

        strategy = IStrategy(pendingStrategy);
        strategy.setVault(address(this));

        //approve new strategy
        DAI.safeApprove(pendingStrategy, type(uint).max);
        USDC.safeApprove(pendingStrategy, type(uint).max);
        USDT.safeApprove(pendingStrategy, type(uint).max);

        strategy.deposit(amount, _token);

        canSetPendingStrategy = true;
        emit MigrateFunds(oldStrategy, pendingStrategy, amount);
    }

    function setAdmin(address _newAdmin) external onlyOwner {
        address oldAdmin = admin;
        admin = _newAdmin;

        emit SetAdmin(oldAdmin, _newAdmin);
    }

    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        require(_treasuryWallet != address(0), "Invalid Address");
        address oldTreasuryWallet = treasuryWallet;
        treasuryWallet = _treasuryWallet;
        strategy.setTreasuryWallet(_treasuryWallet);
        
        emit SetTreasuryWallet(oldTreasuryWallet, _treasuryWallet);
    }

    function setCommunityWallet(address _communityWallet) external onlyOwner{
        require(_communityWallet != address(0), "Invalid Address");
        address oldCommunityWallet = communityWallet;
        communityWallet = _communityWallet;

        emit SetCommunityWallet(oldCommunityWallet, communityWallet);
    }

    function setStrategist(address _strategist) external {
        require(_strategist != address(0), "Invalid Address");
        require(msg.sender == owner() || msg.sender == strategist, "Only admin");
        address oldStrategist = strategist;
        strategist = _strategist;
        emit SetStrategistWallet(oldStrategist, _strategist);
    }

    function getValueInPool() public view returns (uint){
        //returns balance in vault during emergency
        //call strategy.getValueInPool(); if not in emergency

        //commented following for testnet
        return /* isEmergency ? */ DAI.balanceOf(address(this))
        .add(USDC.balanceOf(address(this)).mul(1e12))
        .add(USDT.balanceOf(address(this)).mul(1e12)) /* : strategy.getValueInPool() */;
    }

    function _calcSharesAfterNetworkFee(uint _amount) internal view returns (uint amountAfterFee, uint fee) {
        uint256 _networkFeePerc;
        if (_amount < networkFeeTier2[0]) {
            // Tier 1
            _networkFeePerc = networkFeePerc[0];
        } else if (_amount <= networkFeeTier2[1]) {
            // Tier 2
            _networkFeePerc = networkFeePerc[1];
        } else if (_amount < customNetworkFeeTier) {
            // Tier 3
            _networkFeePerc = networkFeePerc[2];
        } else {
            // Custom Tier
            _networkFeePerc = customNetworkFeePerc;
        }

        fee = _amount.mul(_networkFeePerc).div(10000);
        amountAfterFee = _amount.sub(fee);

    }

    function transferNetworkFee(uint _fee, IERC20 _token) internal {
        uint _feeSplit = _fee.mul(2).div(5);
        _token.safeTransfer(treasuryWallet, _feeSplit);
        _token.safeTransfer(communityWallet, _feeSplit);
        _token.safeTransfer(strategist, _fee.sub(_feeSplit).sub(_feeSplit));
    }
}
