// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../libs/BaseRelayRecipient.sol";

interface IStrategy {
    function getTotalPool() external view returns (uint256);
    function invest(uint256 _amountUSDT, uint256 _amountUSDC, uint256 _amountDAI) external;
    function withdraw(uint256 _amount, uint256 _tokenIndex) external returns (uint256);
    function releaseStablecoinsToVault(uint256 _coinIndex, uint256 _farmIndex, uint256 _amount) external;
    function emergencyWithdraw() external;
    function reinvest() external;
    function setWeights(uint256[] memory _weights) external;
}

interface ICurveSwap {
    function exchange(int128 i, int128 j, uint256 _dx, uint256 _min_dy) external;
}

contract ElonApeVault is ERC20("DAO Vault Elon", "daoELO"), Ownable, BaseRelayRecipient {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    struct Token {
        IERC20 token;
        uint256 decimals;
        uint256 percKeepInVault;
    }

    IStrategy public strategy;
    ICurveSwap private constant c3pool = ICurveSwap(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    uint256 private constant DENOMINATOR = 10000;
    address public admin;

    address public pendingStrategy;
    bool public canSetPendingStrategy;
    uint256 public unlockTime;
    uint256 public constant LOCKTIME = 2 days;

    // Calculation for fees
    uint256[] public networkFeeTier2 = [50000*1e6+1, 100000*1e6]; // 6 decimals
    uint256 public customNetworkFeeTier = 1000000*1e6; // 6 decimals
    uint256[] public networkFeePerc = [100, 75, 50];
    uint256 public customNetworkFeePerc = 25;
    uint256 public profitSharingFeePerc = 2000;
    uint256 private _fees; // 6 decimals

    // Address to collect fees
    address public treasuryWallet;
    address public communityWallet;
    address public strategist;

    mapping(uint256 => Token) public tokens;

    event Deposit(address indexed tokenDeposit, address indexed caller, uint256 amtDeposit, uint256 sharesMint);
    event Withdraw(address indexed tokenWithdraw, address indexed caller, uint256 amtWithdraw, uint256 sharesBurn);
    event TransferredOutFees(uint256 fees);
    event SetNetworkFeeTier2(uint256[] oldNetworkFeeTier2, uint256[] newNetworkFeeTier2);
    event SetNetworkFeePerc(uint256[] oldNetworkFeePerc, uint256[] newNetworkFeePerc);
    event SetCustomNetworkFeeTier(uint256 indexed oldCustomNetworkFeeTier, uint256 indexed newCustomNetworkFeeTier);
    event SetCustomNetworkFeePerc(uint256 indexed oldCustomNetworkFeePerc, uint256 indexed newCustomNetworkFeePerc);
    event SetProfitSharingFeePerc(uint256 indexed oldProfileSharingFeePerc, uint256 indexed newProfileSharingFeePerc);
    event MigrateFunds(address indexed fromStrategy, address indexed toStrategy, uint256 amount);

    modifier onlyAdmin {
        require(msg.sender == address(admin), "Only admin");
        _;
    }

    constructor(
        address _strategy, 
        address _treasuryWallet, address _communityWallet, 
        address _admin, address _strategist, 
        address _biconomy
    ) {
        strategy = IStrategy(_strategy);
        treasuryWallet = _treasuryWallet;
        communityWallet = _communityWallet;
        admin = _admin;
        strategist = _strategist;
        trustedForwarder = _biconomy;

        IERC20 USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
        IERC20 USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        IERC20 DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
        tokens[0] = Token(USDT, 6, 200);
        tokens[1] = Token(USDC, 6, 200);
        tokens[2] = Token(DAI, 18, 200);

        USDT.safeApprove(_strategy, type(uint256).max);
        USDT.safeApprove(address(c3pool), type(uint256).max);
        USDC.safeApprove(_strategy, type(uint256).max);
        USDC.safeApprove(address(c3pool), type(uint256).max);
        DAI.safeApprove(_strategy, type(uint256).max);
        DAI.safeApprove(address(c3pool), type(uint256).max);

        canSetPendingStrategy = true;
    }

    /// @notice Function that required for inherit BaseRelayRecipient
    function _msgSender() internal override(Context, BaseRelayRecipient) view returns (address payable) {
        return BaseRelayRecipient._msgSender();
    }
    
    /// @notice Function that required for inherit BaseRelayRecipient
    function versionRecipient() external pure override returns (string memory) {
        return "1";
    }

    /// @notice Function to deposit Stablecoins
    /// @param _amount Amount to deposit in USD (follow Stablecoins decimals)
    /// @param _tokenIndex Type of Stablecoin to deposit (0 for USDT, 1 for USDC, 2 for DAI)
    function deposit(uint256 _amount, uint256 _tokenIndex) external {
        require(msg.sender == tx.origin || isTrustedForwarder(msg.sender), "Only EOA or Biconomy");
        require(_amount > 0, "Amount must > 0");

        address _sender = _msgSender();
        tokens[_tokenIndex].token.safeTransferFrom(_sender, address(this), _amount);
        uint256 _amtDeposit = _amount; // For event purpose
        if (tokens[_tokenIndex].decimals == 18) { // To make consistency of 6 decimals
            _amount = _amount.div(1e12);
        }
        // Calculate network fee
        uint256 _networkFeePerc;
        if (_amount < networkFeeTier2[0]) { // Tier 1
            _networkFeePerc = networkFeePerc[0];
        } else if (_amount <= networkFeeTier2[1]) { // Tier 2
            _networkFeePerc = networkFeePerc[1];
        } else if (_amount < customNetworkFeeTier) { // Tier 3
            _networkFeePerc = networkFeePerc[2];
        } else { // Custom Tier
            _networkFeePerc = customNetworkFeePerc;
        }
        uint256 _fee = _amount.mul(_networkFeePerc).div(DENOMINATOR);
        _fees = _fees.add(_fee);
        _amount = _amount.sub(_fee);

        uint256 _shares = _amount.mul(1e12);
        _mint(_sender, _shares);
        emit Deposit(address(tokens[_tokenIndex].token), _sender, _amtDeposit, _shares);
    }

    /// @notice Function to withdraw Stablecoins
    /// @param _shares Amount of shares to withdraw (from LP token, 18 decimals)
    /// @param _tokenIndex Type of Stablecoin to withdraw (0 for USDT, 1 for USDC, 2 for DAI)
    function withdraw(uint256 _shares, uint256 _tokenIndex) external {
        require(msg.sender == tx.origin, "Only EOA");
        require(_shares > 0, "Shares must > 0");

        // Calculate withdraw amount
        uint256 _withdrawAmt = getAllPoolInUSD().mul(_shares).div(totalSupply()); // 6 decimals
        _burn(msg.sender, _shares);
        Token memory _token = tokens[_tokenIndex];
        uint256 _balanceOfToken = _token.token.balanceOf(address(this));
        if (_token.decimals == 18) { // To make consistency of 6 decimals
            _balanceOfToken = _balanceOfToken.div(1e12);
        }
        if (_withdrawAmt > _balanceOfToken) {
            // Not enough Stablecoin in vault, need to get from strategy
            _withdrawAmt = strategy.withdraw(_withdrawAmt, _tokenIndex);
        }

        // Calculate profit sharing fee
        // Deposit amount (after fees) = shares amount (18 decimals)
        uint256 _depositAmt = _shares.div(1e12);
        if (_withdrawAmt > _depositAmt) {
            uint256 _profit = _withdrawAmt.sub(_depositAmt);
            uint256 _fee = _profit.mul(profitSharingFeePerc).div(DENOMINATOR);
            _withdrawAmt = _withdrawAmt.sub(_fee);
            _fees = _fees.add(_fee);
        }
        
        if (_token.decimals == 18) { // Recover withdraw amount to 18 decimals for DAI transfer
            _withdrawAmt = _withdrawAmt.mul(1e12);
        }
        _token.token.safeTransfer(msg.sender, _withdrawAmt);
        emit Withdraw(address(tokens[_tokenIndex].token), msg.sender, _withdrawAmt, _shares);
    }

    /// @notice Function to invest funds into strategy
    function invest() external onlyAdmin {
        // Transfer out available network fees
        transferOutNetworkFees();

        // Calculation for keep portion of Stablecoins and transfer balance of Stablecoins to strategy
        uint256 _poolInUSD = getAllPoolInUSD();
        strategy.invest(
            _invest(tokens[0], _poolInUSD), // USDT
            _invest(tokens[1], _poolInUSD), // USDC
            _invest(tokens[2], _poolInUSD) // DAI
        );
    }

    /// @notice Function to determine amount of Stablecoin to invest
    /// @param _token Type of Stablecoin (in struct)
    /// @param _poolInUSD Amount of pool (6 decimals)
    function _invest(Token memory _token, uint256 _poolInUSD) private view returns (uint256) {
        uint256 _tokenBalance = _token.token.balanceOf(address(this));
        uint256 _toKeep = _poolInUSD.mul(_token.percKeepInVault).div(DENOMINATOR);
        if (_tokenBalance > _toKeep) {
            return _tokenBalance.sub(_toKeep);
        } else {
            return 0;
        }
    }

    /// @notice Function to swap Stablecoin within vault with Curve
    /// @param _tokenFrom Type of Stablecoin to be swapped
    /// @param _tokenTo Type of Stablecoin to be received
    /// @param _amount Amount to be swapped (follow Stablecoins decimals)
    function swapTokenWithinVault(uint256 _tokenFrom, uint256 _tokenTo, uint256 _amount) external onlyAdmin {
        require(tokens[_tokenFrom].token.balanceOf(address(this)) > _amount, "Insufficient amount to swap");
        int128 i = _determineCurveIndex(_tokenFrom);
        int128 j = _determineCurveIndex(_tokenTo);
        c3pool.exchange(i, j, _amount, 0);
    }

    /// @notice Function to determine Curve index for swapTokenWithinVault()
    /// @param _tokenIndex Index of Stablecoin (0 for USDT, 1 for USDC, 2 for DAI)
    /// @return Stablecoin index use in Curve
    function _determineCurveIndex(uint256 _tokenIndex) private pure returns (int128) {
        if (_tokenIndex == 0) {
            return 2;
        } else if (_tokenIndex == 1) {
            return 1;
        } else {
            return 0;
        }
    }

    /// @notice Function to retrieve Stablecoins from strategy
    /// @param _tokenIndex Type of Stablecoin to retrieve (0 for USDT, 1 for USDC, 2 for DAI)
    /// @param _farmIndex Type of farm to swap out (0 for sTSLA, 1 for WBTC, 2 for renDOGE)
    /// @param _amount Amount of Stablecoin to retrieve (6 decimals)
    function retrieveStablecoinsFromStrategy(uint256 _tokenIndex, uint256 _farmIndex, uint256 _amount) external onlyAdmin {
        strategy.releaseStablecoinsToVault(_tokenIndex, _farmIndex, _amount);
    }

    /// @notice Function to withdraw all farms and swap to WETH in strategy
    function emergencyWithdraw() external onlyAdmin {
        strategy.emergencyWithdraw();
    }

    /// @notice Function to reinvest all WETH back to farms in strategy
    function reinvest() external onlyAdmin {
        strategy.reinvest();
    }

    /// @notice Function to transfer out available network fees
    function transferOutNetworkFees() public {
        require(msg.sender == address(this) || msg.sender == admin, "Not authorized");
        if (_fees != 0) {
            bool canTransfer;
            Token memory _token;
            if (tokens[0].token.balanceOf(address(this)) > _fees) {
                _token = tokens[0]; // USDT
                canTransfer = true;
            } else if (tokens[1].token.balanceOf(address(this)) > _fees) {
                _token = tokens[1]; // USDC
                canTransfer = true;
            } else if (tokens[2].token.balanceOf(address(this)) > _fees) {
                _token = tokens[2]; // DAI
                canTransfer = true;
            }
            if (canTransfer) {
                uint256 _fee =  _fees.mul(2).div(5); // 40%
                _token.token.safeTransfer(treasuryWallet, _fee); // 40%
                _token.token.safeTransfer(communityWallet, _fee); // 40%
                _token.token.safeTransfer(strategist, _fees.sub(_fee).sub(_fee)); // 20%
                emit TransferredOutFees(_fees);
                _fees = 0;
            }
        }
    }

    /// @notice Function to unlock migrateFunds()
    function unlockMigrateFunds() external onlyOwner {
        unlockTime = block.timestamp.add(LOCKTIME);
        canSetPendingStrategy = false;
    }

    /// @notice Function to migrate all funds from old strategy contract to new strategy contract
    /// @notice This function only last for 1 days after success unlocked
    function migrateFunds() external onlyOwner {
        require(unlockTime <= block.timestamp && unlockTime.add(1 days) >= block.timestamp, "Function locked");
        IERC20 WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        uint256 _amount = WETH.balanceOf(address(strategy));
        require(_amount > 0, "No balance to migrate");
        require(pendingStrategy != address(0), "No pendingStrategy");

        WETH.safeTransferFrom(address(strategy), pendingStrategy, _amount);

        // Set new strategy
        address oldStrategy = address(strategy); // For event purpose
        strategy = IStrategy(pendingStrategy);
        pendingStrategy = address(0);
        canSetPendingStrategy = true;

        // Approve new strategy
        tokens[0].token.safeApprove(address(strategy), type(uint256).max);
        tokens[0].token.safeApprove(oldStrategy, 0);
        tokens[1].token.safeApprove(address(strategy), type(uint256).max);
        tokens[1].token.safeApprove(oldStrategy, 0);
        tokens[2].token.safeApprove(address(strategy), type(uint256).max);
        tokens[2].token.safeApprove(oldStrategy, 0);

        unlockTime = 0; // Lock back this function
        emit MigrateFunds(oldStrategy, address(strategy), _amount);
    }

    /// @notice Function to set new network fee for deposit amount tier 2
    /// @param _networkFeeTier2 Array that contains minimum and maximum amount of tier 2 (6 decimals)
    function setNetworkFeeTier2(uint256[] calldata _networkFeeTier2) external onlyOwner {
        require(_networkFeeTier2[0] != 0, "Minimun amount cannot be 0");
        require(_networkFeeTier2[1] > _networkFeeTier2[0], "Maximun amount must greater than minimun amount");
        /**
         * Network fees have three tier, but it is sufficient to have minimun and maximun amount of tier 2
         * Tier 1: deposit amount < minimun amount of tier 2
         * Tier 2: minimun amount of tier 2 <= deposit amount <= maximun amount of tier 2
         * Tier 3: amount > maximun amount of tier 2
         */
        uint256[] memory oldNetworkFeeTier2 = networkFeeTier2; // For event purpose
        networkFeeTier2 = _networkFeeTier2;
        emit SetNetworkFeeTier2(oldNetworkFeeTier2, _networkFeeTier2);
    }

    /// @notice Function to set new custom network fee tier
    /// @param _customNetworkFeeTier Amount of new custom network fee tier (6 decimals)
    function setCustomNetworkFeeTier(uint256 _customNetworkFeeTier) external onlyOwner {
        require(_customNetworkFeeTier > networkFeeTier2[1], "Custom network fee tier must greater than tier 2");
        uint256 oldCustomNetworkFeeTier = customNetworkFeeTier; // For event purpose
        customNetworkFeeTier = _customNetworkFeeTier;
        emit SetCustomNetworkFeeTier(oldCustomNetworkFeeTier, _customNetworkFeeTier);
    }

    /// @notice Function to set new network fee percentage
    /// @param _networkFeePerc Array that contains new network fee percentage for tier 1, tier 2 and tier 3
    function setNetworkFeePerc(uint256[] calldata _networkFeePerc) external onlyOwner {
        require(_networkFeePerc[0] < 3000 && _networkFeePerc[1] < 3000 && _networkFeePerc[2] < 3000,
            "Network fee percentage cannot be more than 30%");
        /**
         * _networkFeePerc content a array of 3 element, representing network fee of tier 1, tier 2 and tier 3
         * For example networkFeePerc is [100, 75, 50],
         * which mean network fee for Tier 1 = 1%, Tier 2 = 0.75% and Tier 3 = 0.5% (DENOMINATOR = 10000)
         */
        uint256[] memory oldNetworkFeePerc = networkFeePerc; // For event purpose
        networkFeePerc = _networkFeePerc;
        emit SetNetworkFeePerc(oldNetworkFeePerc, _networkFeePerc);
    }

    /// @notice Function to set new custom network fee percentage
    /// @param _percentage Percentage of new custom network fee
    function setCustomNetworkFeePerc(uint256 _percentage) public onlyOwner {
        require(_percentage < networkFeePerc[2], "Custom network fee percentage cannot be more than tier 2");
        uint256 oldCustomNetworkFeePerc = customNetworkFeePerc; // For event purpose
        customNetworkFeePerc = _percentage;
        emit SetCustomNetworkFeePerc(oldCustomNetworkFeePerc, _percentage);
    }

    /// @notice Function to set new profit sharing fee percentage
    /// @param _percentage Percentage of new profit sharing fee
    function setProfitSharingFeePerc(uint256 _percentage) external onlyOwner {
        require(_percentage < 3000, "Profile sharing fee percentage cannot be more than 30%");
        uint256 oldProfitSharingFeePerc = profitSharingFeePerc; // For event purpose
        profitSharingFeePerc = _percentage;
        emit SetProfitSharingFeePerc(oldProfitSharingFeePerc, _percentage);
    }

    /// @notice Function to set new treasury wallet address
    /// @param _treasuryWallet Address of new treasury wallet
    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        treasuryWallet = _treasuryWallet;
    }

    /// @notice Function to set new community wallet address
    /// @param _communityWallet Address of new community wallet
    function setCommunityWallet(address _communityWallet) external onlyOwner {
        communityWallet = _communityWallet;
    }

    /// @notice Function to set new admin address
    /// @param _admin Address of new admin
    function setAdmin(address _admin) external onlyOwner {
        admin = _admin;
    }

    /// @notice Function to set new strategist address
    /// @param _strategist Address of new strategist
    function setStrategist(address _strategist) external {
        require(msg.sender == strategist || msg.sender == owner(), "Not authorized");
        strategist = _strategist;
    }

    /// @notice Function to set pending strategy address
    /// @param _pendingStrategy Address of pending strategy
    function setPendingStrategy(address _pendingStrategy) external onlyOwner {
        require(canSetPendingStrategy, "Cannot set pending strategy now");
        pendingStrategy = _pendingStrategy;
    }

    /// @notice Function to set new trusted forwarder address (Biconomy)
    /// @param _biconomy Address of new trusted forwarder
    function setBiconomy(address _biconomy) external onlyOwner {
        trustedForwarder = _biconomy;
    }

    /// @notice Function to set percentage of Stablecoins that keep in vault
    /// @param _percentages Array with new percentages of Stablecoins that keep in vault (3 elements, DENOMINATOR = 10000)
    function setPercTokenKeepInVault(uint256[] memory _percentages) external onlyAdmin {
        tokens[0].percKeepInVault = _percentages[0];
        tokens[1].percKeepInVault = _percentages[1];
        tokens[2].percKeepInVault = _percentages[2];
    }

    /// @notice Function to set weight of farms in strategy
    /// @param _weights Array with new weight(percentage) of farms (3 elements, DENOMINATOR = 10000)
    function setWeights(uint256[] memory _weights) external onlyAdmin {
        strategy.setWeights(_weights);
    }

    /// @notice Function to get all pool amount(vault+strategy) in USD
    /// @return All pool in USD (6 decimals)
    function getAllPoolInUSD() public view returns (uint256) {
        uint256 _vaultPoolInUSD = (tokens[0].token.balanceOf(address(this)))
            .add(tokens[1].token.balanceOf(address(this)))
            .add(tokens[2].token.balanceOf(address(this)).div(1e12)) // DAI to 6 decimals
            .sub(_fees);
        return strategy.getTotalPool().add(_vaultPoolInUSD);
    }
}