// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

interface ICitadelStrategy {
    function getTotalPool() external view returns (uint256);
    function invest(uint256 _amount) external;
    function withdraw(uint256 _amount) external;
    function reimburse() external;
    function setAdmin(address _admin) external;
    function setStrategist(address _strategist) external;
    function emergencyWithdraw() external;
    function reinvest() external;
}

interface IRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface ICurveSwap {
    function exchange(int128 i, int128 j, uint256 _dx, uint256 _min_dy) external;
}

interface IChainlink {
    function latestRoundData() external view returns (uint80, int, uint256, uint256, uint80);
}

contract CitadelVault is ERC20("DAO Citadel Vault", "DCV"), Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    enum TokenType { USDT, USDC, DAI }
    IERC20 public constant USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 public constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 public constant DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 public constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    ICitadelStrategy public strategy;
    IRouter public constant router = IRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    ICurveSwap public constant c3pool = ICurveSwap(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);

    uint256 public constant DENOMINATOR = 10000;
    uint256 public keepUSDT = 200;
    uint256 public keepUSDC = 200;
    uint256 public keepDAI = 200;

    address public pendingStrategy;
    bool public canSetPendingStrategy;
    uint256 public unlockTime;
    uint256 public constant LOCKTIME = 2 days;

    // Calculation for fees
    uint256[] public networkFeeTier2 = [50000*1e18+1, 100000*1e18];
    uint256 public customNetworkFeeTier = 1000000*1e18;
    uint256[] public networkFeePerc = [100, 75, 50];
    uint256 public customNetworkFeePerc = 25;
    uint256 public profitSharingFeePerc = 2000;
    uint256 private _fees; // 18 decimals

    // Address to collect fees
    address public treasuryWallet;
    address public communityWallet;
    address public admin;
    address public strategist;

    // Record deposit amount (USD in 18 decimals)
    mapping(address => uint256) private _balanceOfDeposit;

    event TransferredOutFees(uint256 fees);
    event ETHToInvest(uint256 _balanceOfWETH);
    event SetNetworkFeeTier2(uint256[] oldNetworkFeeTier2, uint256[] newNetworkFeeTier2);
    event SetNetworkFeePerc(uint256[] oldNetworkFeePerc, uint256[] newNetworkFeePerc);
    event SetCustomNetworkFeeTier(uint256 indexed oldCustomNetworkFeeTier, uint256 indexed newCustomNetworkFeeTier);
    event SetCustomNetworkFeePerc(uint256 oldCustomNetworkFeePerc, uint256 newCustomNetworkFeePerc);
    event SetProfitSharingFeePerc(uint256 indexed oldProfileSharingFeePerc, uint256 indexed newProfileSharingFeePerc);
    event MigrateFunds(address indexed fromStrategy, address indexed toStrategy, uint256 amount);

    modifier onlyEOA {
        require(msg.sender == tx.origin, "Only EOA");
        _;
    }

    modifier onlyAdmin {
        require(msg.sender == address(admin), "Only admin");
        _;
    }

    constructor(address _strategy, address _treasuryWallet, address _communityWallet, address _admin, address _strategist) {
        strategy = ICitadelStrategy(_strategy);
        treasuryWallet = _treasuryWallet;
        communityWallet = _communityWallet;
        admin = _admin;
        strategist = _strategist;

        WETH.safeApprove(_strategy, type(uint256).max);
        WETH.safeApprove(address(router), type(uint256).max);
        USDT.safeApprove(address(router), type(uint256).max);
        USDT.safeApprove(address(c3pool), type(uint256).max);
        USDC.safeApprove(address(router), type(uint256).max);
        USDC.safeApprove(address(c3pool), type(uint256).max);
        DAI.safeApprove(address(router), type(uint256).max);
        DAI.safeApprove(address(c3pool), type(uint256).max);
    }

    /// @notice Function to deposit stablecoins
    /// @param _amount Amount to deposit
    /// @param _tokenType Type of stablecoin to deposit
    function deposit(uint256 _amount, TokenType _tokenType) external onlyEOA {
        require(_amount > 0, "Amount must > 0");

        uint256 _shares;
        // Change total pool to 18 decimals to calculate distributed LP token in 18 decimals
        uint256 _pool = _getAllPoolInETH();
        if (_tokenType == TokenType.USDT) {
            USDT.safeTransferFrom(msg.sender, address(this), _amount);
            _amount = _amount.mul(1e12);
            _shares = _deposit(_amount, _pool);
        } else if (_tokenType == TokenType.USDC) {
            USDC.safeTransferFrom(msg.sender, address(this), _amount);
            _amount = _amount.mul(1e12);
            _shares = _deposit(_amount, _pool);
        } else {
            DAI.safeTransferFrom(msg.sender, address(this), _amount);
            _shares = _deposit(_amount, _pool);
        }
        _mint(msg.sender, _shares);
    }

    /// @notice deposit() nested function
    /// @param _amount Amount to deposit (18 decimals)
    /// @param _pool Total amount of pool in ETH include vault and strategy
    /// @return _shares Amount of shares (18 decimals)
    function _deposit(uint256 _amount, uint256 _pool) private returns (uint256 _shares) {
        // Calculate network fee
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
        uint256 _fee = _amount.mul(_networkFeePerc).div(DENOMINATOR);
        _fees = _fees.add(_fee);
        _amount = _amount.sub(_fee);

        _balanceOfDeposit[msg.sender] = _balanceOfDeposit[msg.sender].add(_amount);
        uint256 _amountInETH = _amount.mul(_getPriceFromChainlink(0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46)).div(1e18);
        _shares = totalSupply() == 0 ? _amountInETH : _amountInETH.mul(totalSupply()).div(_pool);
    }

    /// @notice Function to withdraw
    /// @param _shares Amount of shares to withdraw (from LP token, 18 decimals)
    /// @param _tokenType Type of stablecoin to withdraw
    function withdraw(uint256 _shares, TokenType _tokenType) external onlyEOA {
        require(_shares > 0, "Shares must > 0");
        
        if (_tokenType == TokenType.USDT) {
            _withdraw(_shares, USDT);
        } else if (_tokenType == TokenType.USDC) {
            _withdraw(_shares, USDC);
        } else {
            _withdraw(_shares, DAI);
        }
    }

    /// @notice withdraw() nested function
    /// @param _shares Amount of shares to withdraw (18 decimals)
    /// @param _token Type of stablecoin to withdraw
    function _withdraw(uint256 _shares, IERC20 _token) private {
        uint256 _totalShares = balanceOf(msg.sender);
        require(_totalShares >= _shares, "Insufficient balance to withdraw");

        // Calculate deposit amount
        uint256 _percWithdraw = _shares.mul(DENOMINATOR).div(_totalShares);
        uint256 _depositAmt = _balanceOfDeposit[msg.sender].mul(_percWithdraw).div(DENOMINATOR);
        // Subtract deposit amount
        _balanceOfDeposit[msg.sender] = _balanceOfDeposit[msg.sender].sub(_depositAmt);

        // Calculate withdraw amount
        uint256 _withdrawAmt = _getAllPoolInETH().mul(_shares).div(totalSupply());
        uint256 _withdrawAmtInUSD = _withdrawAmt.mul(_getPriceFromChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419)).div(1e8); // ETH/USD
        uint256 _balanceOfToken = _token.balanceOf(address(this));
        _balanceOfToken = _token == DAI ? _balanceOfToken : _balanceOfToken.mul(1e12);
        if (_withdrawAmtInUSD > _balanceOfToken) {
            // Not enough stablecoin in vault, need to get from strategy
            strategy.withdraw(_withdrawAmt);
            uint256[] memory _amounts = _swapExactTokensForTokens(WETH.balanceOf(address(this)), address(WETH), address(_token));
            // Change withdraw amount to 18 decimals if not DAI (for calculate profit sharing fee)
            _withdrawAmtInUSD = _token == DAI ? _amounts[1] : _amounts[1].mul(1e12);
        }

        // Calculate profit sharing fee
        if (_withdrawAmtInUSD > _depositAmt) {
            uint256 _profit = _withdrawAmt.sub(_depositAmt);
            uint256 _fee = _profit.mul(profitSharingFeePerc).div(DENOMINATOR);
            _withdrawAmt = _withdrawAmt.sub(_fee);
            _fees = _fees.add(_fee);
        }

        _burn(msg.sender, _shares);
        // Change back withdraw amount to 6 decimals if not DAI
        _withdrawAmtInUSD = _token == DAI ? _withdrawAmtInUSD : _withdrawAmtInUSD.div(1e12);
        _token.safeTransfer(msg.sender, _withdrawAmtInUSD);
    }

    /// @notice Function to invest funds into strategy
    function invest() external onlyAdmin {
        // Transfer out network fees
        _fees = _fees.div(1e12); // Convert to USDT decimals
        if (_fees != 0 && USDT.balanceOf(address(this)) > _fees) {
            USDT.safeTransfer(treasuryWallet, _fees.mul(4000).div(DENOMINATOR));
            USDT.safeTransfer(communityWallet, _fees.mul(4000).div(DENOMINATOR));
            USDT.safeTransfer(strategist, _fees.mul(2000).div(DENOMINATOR));
            emit TransferredOutFees(_fees);
            _fees = 0;
        }

        // Calculation for keep portion of stablecoins and swap remainder to WETH
        uint256 _toKeepUSDT = getAllPoolInUSD().mul(keepUSDT).div(DENOMINATOR);
        uint256 _toKeepUSDC = getAllPoolInUSD().mul(keepUSDC).div(DENOMINATOR);
        uint256 _toKeepDAI = getAllPoolInUSD().mul(keepDAI).div(DENOMINATOR);
        _invest(USDT, _toKeepUSDT);
        _invest(USDC, _toKeepUSDC);
        _toKeepDAI = _toKeepDAI.mul(1e12); // Follow decimals of DAI
        _invest(DAI, _toKeepDAI);

        // Invest all swapped WETH to strategy
        uint256 _balanceOfWETH = WETH.balanceOf(address(this));
        strategy.invest(_balanceOfWETH);
        emit ETHToInvest(_balanceOfWETH);
    }

    /// @notice Function to swap stablecoin to WETH
    /// @param _token Stablecoin to swap
    /// @param _toKeepAmt Amount to keep in vault (decimals follow stablecoins)
    function _invest(IERC20 _token, uint256 _toKeepAmt) private {
        uint256 _balanceOfToken = _token.balanceOf(address(this));
        if (_balanceOfToken > _toKeepAmt) {
            _swapExactTokensForTokens(_balanceOfToken.sub(_toKeepAmt), address(_token), address(WETH));
        }
    }

    /// @notice Function to swap stablecoin within vault with Curve
    /// @notice Amount to swap == amount to keep in vault of _tokenTo stablecoin
    /// @param _tokenFrom Type of stablecoin to be swapped
    /// @param _tokenTo Type of stablecoin to be received
    function swapTokenWithinVault(TokenType _tokenFrom, TokenType _tokenTo) external onlyAdmin {
        (IERC20 _from, int128 i) = _determineTokenType(_tokenFrom);
        (IERC20 _to, int128 j) = _determineTokenType(_tokenTo);
        uint256 _reimburseAmt = getReimburseTokenAmount(_tokenTo);
        uint256 _balanceOfFrom = _from.balanceOf(address(this));
        // Make all variable consistent with 6 decimals 
        _balanceOfFrom = _from == DAI ? _balanceOfFrom.div(1e12) : _balanceOfFrom;
        _reimburseAmt = _to == DAI ? _reimburseAmt.div(1e12) : _reimburseAmt;

        require(_balanceOfFrom > _reimburseAmt, "Insufficient amount to swap");
        c3pool.exchange(i, j, _reimburseAmt, 0);
    }

    /// @notice Function to determine stablecoin type for swapTokenWithinVault()
    /// @param _token Type of stablecoin (in enum)
    /// @return Type of stablecoin (in ERC20) and stablecoin index use in Curve
    function _determineTokenType(TokenType _token) private pure returns (IERC20, int128) {
        if (_token == TokenType.USDT) {
            return (USDT, 2);
        } else if (_token == TokenType.USDC) {
            return (USDC, 1);
        } else {
            return (DAI, 0);
        }
    }

    /// @notice Function to reimburse keep Tokens from strategy
    /// @notice This function remove liquidity from all strategy farm and will cost massive gas fee. Only call when needed.
    function reimburseTokenFromStrategy() external onlyAdmin {
        strategy.reimburse();
    }

    /// @notice Function to withdraw all farms and swap to WETH in strategy
    function emergencyWithdraw() external onlyAdmin {
        strategy.emergencyWithdraw();
    }

    /// @notice Function to reinvest all WETH back to farms in strategy
    function reinvest() external onlyAdmin {
        strategy.reinvest();
    }

    /// @notice Function to swap between tokens with Uniswap
    /// @param _amountIn Amount to swap
    /// @param _fromToken Token to be swapped
    /// @param _toToken Token to be received
    /// @return _amounts Array that contain amount swapped
    function _swapExactTokensForTokens(uint256 _amountIn, address _fromToken, address _toToken) private returns (uint256[] memory _amounts) {
        address[] memory _path = new address[](2);
        _path[0] = _fromToken;
        _path[1] = _toToken;
        uint256[] memory _amountsOut = router.getAmountsOut(_amountIn, _path);
        if (_amountsOut[1] > 0) {
            _amounts = router.swapExactTokensForTokens(_amountIn, 0, _path, address(this), block.timestamp);
        } else {
            // Not enough amount to swap
            uint256[] memory _zeroReturn = new uint256[](2);
            _zeroReturn[0] = 0;
            _zeroReturn[1] = 0;
            return _zeroReturn;
        }
    }

    /// @notice Function to set new network fee for deposit amount tier 2
    /// @param _networkFeeTier2 Array that contains minimum and maximum amount of tier 2
    function setNetworkFeeTier2(uint256[] calldata _networkFeeTier2) external onlyOwner {
        require(_networkFeeTier2[0] != 0, "Minimun amount cannot be 0");
        require(_networkFeeTier2[1] > _networkFeeTier2[0], "Maximun amount must greater than minimun amount");
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

    /// @notice Function to set new custom network fee tier
    /// @param _customNetworkFeeTier Amount of new custom network fee tier
    function setCustomNetworkFeeTier(uint256 _customNetworkFeeTier) external onlyOwner {
        require(_customNetworkFeeTier > networkFeeTier2[1], "Custom network fee tier must greater than tier 2");

        uint256 oldCustomNetworkFeeTier = customNetworkFeeTier;
        customNetworkFeeTier = _customNetworkFeeTier;
        emit SetCustomNetworkFeeTier(oldCustomNetworkFeeTier, _customNetworkFeeTier);
    }

    /// @notice Function to set new network fee percentage
    /// @param _networkFeePerc Array that contains new network fee percentage for tier 1, tier 2 and tier 3
    function setNetworkFeePerc(uint256[] calldata _networkFeePerc) external onlyOwner {
        require(
            _networkFeePerc[0] < 3000 &&
                _networkFeePerc[1] < 3000 &&
                _networkFeePerc[2] < 3000,
            "Network fee percentage cannot be more than 30%"
        );
        /**
         * _networkFeePerc content a array of 3 element, representing network fee of tier 1, tier 2 and tier 3
         * For example networkFeePerc is [100, 75, 50]
         * which mean network fee for Tier 1 = 1%, Tier 2 = 0.75% and Tier 3 = 0.5%
         */
        uint256[] memory oldNetworkFeePerc = networkFeePerc;
        networkFeePerc = _networkFeePerc;
        emit SetNetworkFeePerc(oldNetworkFeePerc, _networkFeePerc);
    }

    /// @notice Function to set new custom network fee percentage
    /// @param _percentage Percentage of new custom network fee
    function setCustomNetworkFeePerc(uint256 _percentage) public onlyOwner {
        require(_percentage < networkFeePerc[2], "Custom network fee percentage cannot be more than tier 2");

        uint256 oldCustomNetworkFeePerc = customNetworkFeePerc;
        customNetworkFeePerc = _percentage;
        emit SetCustomNetworkFeePerc(oldCustomNetworkFeePerc, _percentage);
    }

    /// @notice Function to set new profit sharing fee percentage
    /// @param _percentage Percentage of new profit sharing fee percentage
    function setProfitSharingFeePerc(uint256 _percentage) external onlyOwner {
        require(_percentage < 3000, "Profile sharing fee percentage cannot be more than 30%");

        uint256 oldProfitSharingFeePerc = profitSharingFeePerc;
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
        strategy.setAdmin(_admin);
    }

    /// @notice Function to set new strategist address
    /// @param _strategist Address of new strategist
    function setStrategist(address _strategist) external {
        require(msg.sender == strategist || msg.sender == owner(), "Not authorized");

        strategist = _strategist;
        strategy.setStrategist(_strategist);
    }

    /// @notice Function to set pending strategy address
    /// @notice Address of pending strategy
    function setPendingStrategy(address _pendingStrategy) external onlyOwner {
        require(canSetPendingStrategy, "Cannot set pending strategy now");

        pendingStrategy = _pendingStrategy;
    }

    /// @notice Function to unlock migrate funds function
    function unlockMigrateFunds() external onlyOwner {
        unlockTime = block.timestamp.add(LOCKTIME);
        canSetPendingStrategy = false;
    }

    /// @notice Function to migrate all funds from old strategy contract to new strategy contract
    function migrateFunds() external onlyOwner {
        require(unlockTime <= block.timestamp && unlockTime.add(1 days) >= block.timestamp, "Function locked");
        require(WETH.balanceOf(address(strategy)) > 0, "No balance to migrate");
        require(pendingStrategy != address(0), "No pendingStrategy");

        uint256 _amount = WETH.balanceOf(address(strategy));
        WETH.safeTransferFrom(address(strategy), pendingStrategy, _amount);

        // Set new strategy
        address oldStrategy = address(strategy);
        strategy = ICitadelStrategy(pendingStrategy);
        pendingStrategy = address(0);
        canSetPendingStrategy = true;

        // Approve new strategy
        WETH.safeApprove(address(strategy), type(uint256).max);
        WETH.safeApprove(oldStrategy, 0);

        unlockTime = 0; // Lock back this function
        emit MigrateFunds(oldStrategy, address(strategy), _amount);
    }

    /// @notice Function to get all pool amount(vault+strategy) in USD
    /// @return All pool in USD (6 decimals follow USDT)
    function getAllPoolInUSD() public view returns (uint256) {
        uint256 _price = _getPriceFromChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419); // ETH/USD
        return _getAllPoolInETH().mul(_price).div(1e20);
    }

    /// @notice Function to get all pool amount(vault+strategy) in ETH
    /// @return All pool in ETH (18 decimals)
    function _getAllPoolInETH() private view returns (uint256) {
        // Get exact USD amount of value (no decimals) 
        uint256 _vaultPoolInUSD = (USDT.balanceOf(address(this)).div(1e6))
            .add(USDC.balanceOf(address(this)).div(1e6))
            .add(DAI.balanceOf(address(this)).div(1e18));
        uint256 _vaultPoolInETH = _vaultPoolInUSD.mul(_getPriceFromChainlink(0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46)); // USDT/ETH
        return strategy.getTotalPool().add(_vaultPoolInETH);
    }

    /// @notice Function to get price from ChainLink contract
    /// @param _priceFeedProxy Address of ChainLink contract that provide price
    /// @return Price (8 decimals for USD, 18 decimals for ETH)
    function _getPriceFromChainlink(address _priceFeedProxy) private view returns (uint256) {
        IChainlink pricefeed = IChainlink(_priceFeedProxy);
        (, int256 price, , ,) = pricefeed.latestRoundData();
        return uint256(price);
    }

    /// @notice Function to get amount need to fill up minimum amount keep in vault
    /// @param _tokenType Type of stablecoin requested
    /// @return Amount to reimburse (USDT, USDC 6 decimals, DAI 18 decimals)
    function getReimburseTokenAmount(TokenType _tokenType) public view returns (uint256) {
        uint256 _keepToken; // Percentage to keep in vault
        IERC20 _token;
        if (_tokenType == TokenType.USDT) {
            _keepToken = keepUSDT;
            _token = USDT;
        } else if (_tokenType == TokenType.USDC) {
            _keepToken = keepUSDC;
            _token = USDC;
        } else {
            _keepToken = keepDAI;
            _token = DAI;
        }
        uint256 _toKeepAmt = getAllPoolInUSD().mul(_keepToken).div(DENOMINATOR);
        // Change _toKeepAmt to 18 decimals if _token == DAI
        _toKeepAmt = _token == DAI ? _toKeepAmt = _toKeepAmt.mul(1e12) : _toKeepAmt;
        uint256 _balanceOfToken = _token.balanceOf(address(this));
        if (_balanceOfToken < _toKeepAmt) {
            return _toKeepAmt.sub(_balanceOfToken);
        }
        return 0; // amount keep in vault is full
    }
}
