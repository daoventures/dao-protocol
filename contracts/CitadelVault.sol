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
    function emergencyWithdraw() external;
    function reinvest() external;
}

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 _amount) external;
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

/// @title Contract to interact between user and strategy, and distribute daoToken
contract CitadelVault is ERC20("DAO Citadel Vault", "DCV"), Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;
    using Address for address;
    using SafeMath for uint256;

    enum TokenType { USDT, USDC, DAI }
    IERC20 public constant USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 public constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 public constant DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IWETH public constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    ICitadelStrategy public strategy;
    IRouter public constant router = IRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    ICurveSwap public constant c3pool = ICurveSwap(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    address public admin;

    uint256 public constant DENOMINATOR = 10000;
    uint256 public keepUSDT = 200;
    uint256 public keepUSDC = 200;
    uint256 public keepDAI = 200;
    // uint256 public keepUSDT = 0; // Temporarily for testing
    // uint256 public keepUSDC = 0; // Temporarily for testing
    // uint256 public keepDAI = 0; // Temporarily for testing

    address public pendingStrategy;
    bool public canSetPendingStrategy;
    uint256 public unlockTime;
    uint256 public constant LOCKTIME = 2 days;

    // Calculation for fees
    uint256[] public networkFeeTier2 = [50000*10e17+1, 100000*10e17];
    uint256 public customNetworkFeeTier = 1000000*10e17;
    // uint256[] public networkFeePercentage = [100, 75, 50];
    uint256[] public networkFeePercentage = [0, 0, 0]; // Temporarily for testing
    uint256 public customNetworkFeePercentage = 25;
    // uint256 public profitSharingFeePercentage = 2000;
    uint256 public profitSharingFeePercentage = 0; // Temporarily for testing
    uint256 private fees;

    // Address to collect fees
    address public treasuryWallet = 0x59E83877bD248cBFe392dbB5A8a29959bcb48592;
    address public communityWallet = 0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0;
    address public strategist;

    // Record deposit amount
    mapping(address => uint256) private _balanceOfDeposit; // USD in 18 decimals

    modifier onlyEOA {
        require(msg.sender == tx.origin, "Only EOA");
        _;
    }

    modifier onlyAdmin {
        require(msg.sender == address(admin), "Only admin");
        _;
    }

    constructor(address _strategy, address _admin, address _strategist) {
        strategy = ICitadelStrategy(_strategy);
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

    function _deposit(uint256 _amount, uint256 _pool) private returns (uint256 _shares) {
        _amount = _calcNetworkFee(_amount);
        _balanceOfDeposit[msg.sender] = _balanceOfDeposit[msg.sender].add(_amount);
        uint256 _amountInETH = _amount.mul(_getPriceFromChainlink(0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46)).div(1e18);
        _shares = totalSupply() == 0 ? _amountInETH : _amountInETH.mul(totalSupply()).div(_pool);
        // console.log(_amountInETH, totalSupply(), _getAllPoolInETH());
        // console.log(_shares);
    }

    /// @notice Function to calculate network fee
    /// @return Deposit amount after network fee
    function _calcNetworkFee(uint256 _amount) private returns (uint256) {
        uint256 _networkFeePercentage;
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
        uint256 _fee = _amount.mul(_networkFeePercentage).div(DENOMINATOR);
        fees = fees.add(_fee);
        return _amount.sub(_fee);
    }

    function withdraw(uint256 _shares, TokenType _tokenType) external onlyEOA {
        require(_shares > 0, "Amount must > 0");
        
        if (_tokenType == TokenType.USDT) {
            _withdraw(_shares, USDT);
        } else if (_tokenType == TokenType.USDC) {
            _withdraw(_shares, USDC);
        } else {
            _withdraw(_shares, DAI);
        }
    }

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
        // console.log(_withdrawAmtInUSD, _balanceOfToken); // 297.924325442337744962 600.414506000000000000
        if (_withdrawAmtInUSD > _balanceOfToken) {
            // Not encough token in vault, need to get from strategy
            if (_token == DAI) {
                _withdrawAmt = _withdrawAmt.div(10e11);
            }
            strategy.withdraw(_withdrawAmt);
            uint256[] memory amounts = _swapExactTokensForTokens(WETH.balanceOf(address(this)), address(WETH), address(_token));
            _withdrawAmt = amounts[1];
        }

        // Calculate profit sharing fee
        // console.log(_withdrawAmtInUSD, _depositAmt); // 297.924325442337744962 300.000000000000000000
        if (_withdrawAmtInUSD > _depositAmt) {
            uint256 _profit = _withdrawAmt.sub(_depositAmt);
            uint256 _fee = _profit.mul(profitSharingFeePercentage).div(DENOMINATOR);
            _withdrawAmt = _withdrawAmt.sub(_fee);
            fees = fees.add(_fee);
        }

        _burn(msg.sender, _shares);
        _withdrawAmtInUSD = _token == DAI ? _withdrawAmtInUSD : _withdrawAmtInUSD.div(1e12);
        _token.safeTransfer(msg.sender, _withdrawAmtInUSD);
    }

    function invest() external onlyAdmin {
        // Transfer network fees to treasury and community wallet
        if (fees != 0 && USDT.balanceOf(address(this)) > fees) {
            USDT.safeTransfer(treasuryWallet, fees.mul(4000).div(DENOMINATOR));
            USDT.safeTransfer(communityWallet, fees.mul(4000).div(DENOMINATOR));
            USDT.safeTransfer(strategist, fees.mul(2000).div(DENOMINATOR));
            fees = 0;
        }

        // Calculation for keep portion of token and swap remainder to WETH
        uint256 _toKeepUSDT = getAllPoolInUSD().mul(keepUSDT).div(DENOMINATOR);
        uint256 _toKeepUSDC = getAllPoolInUSD().mul(keepUSDC).div(DENOMINATOR);
        uint256 _toKeepDAI = getAllPoolInUSD().mul(keepDAI).div(DENOMINATOR);
        _invest(USDT, _toKeepUSDT);
        _invest(USDC, _toKeepUSDC);
        _toKeepDAI = _toKeepDAI.mul(1e12); // Follow decimals of DAI
        _invest(DAI, _toKeepDAI);

        // Invest all swapped WETH to strategy
        strategy.invest(WETH.balanceOf(address(this)));
    }

    function _invest(IERC20 _token, uint256 _toKeepToken) private {
        uint256 _balanceOfToken = _token.balanceOf(address(this));
        if (_balanceOfToken > _toKeepToken) {
            _swapExactTokensForTokens(_balanceOfToken.sub(_toKeepToken), address(_token), address(WETH));
        }
    }

    function swapTokenWithinVault(TokenType _tokenFrom, TokenType _tokenTo) external onlyAdmin {
        (IERC20 _from, int128 i) = _determineTokenType(_tokenFrom);
        (IERC20 _to, int128 j) = _determineTokenType(_tokenTo);
        uint256 _reimburseAmt = getReimburseTokenAmount(_tokenTo);
        require(_from.balanceOf(address(this)) > _reimburseAmt, "Insufficient amount to swap");
        c3pool.exchange(i, j, _reimburseAmt, 0);
    }

    function _determineTokenType(TokenType _token) private pure returns (IERC20, int128) {
        if (_token == TokenType.USDT) {
            return (USDT, 2);
        } else if (_token == TokenType.USDC) {
            return (USDC, 1);
        } else {
            return (DAI, 0);
        }
    }

    /// @notice Reimburse keep Tokens from strategy
    /// @notice This function remove liquidity from all strategy farm and will cost massive gas fee. Only call when needed.
    function reimburseTokenFromStrategy() external onlyAdmin {
        strategy.reimburse();
    }

    function emergencyWithdraw() external onlyAdmin {
        strategy.emergencyWithdraw();
    }

    function reinvest() external onlyAdmin {
        strategy.reinvest();
    }

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
        // emit SetNetworkFeeTier2(oldNetworkFeeTier2, _networkFeeTier2);
    }

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
        // emit SetCustomNetworkFeeTier(
        //     oldCustomNetworkFeeTier,
        //     _customNetworkFeeTier
        // );
    }

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
        // emit SetNetworkFeePercentage(
        //     oldNetworkFeePercentage,
        //     _networkFeePercentage
        // );
    }

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
        // emit SetCustomNetworkFeePercentage(
        //     oldCustomNetworkFeePercentage,
        //     _percentage
        // );
    }

    function setProfitSharingFeePercentage(uint256 _percentage) external onlyOwner {
        require(_percentage < 3000, "Profile sharing fee percentage cannot be more than 30%");

        uint256 oldProfitSharingFeePercentage = profitSharingFeePercentage;
        profitSharingFeePercentage = _percentage;
        // emit SetProfitSharingFeePercentage(oldProfitSharingFeePercentage, _percentage);
    }

    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        address oldTreasuryWallet = treasuryWallet;
        treasuryWallet = _treasuryWallet;
        // emit SetTreasuryWallet(oldTreasuryWallet, _treasuryWallet);
    }

    function setCommunityWallet(address _communityWallet) external onlyOwner {
        address oldCommunityWallet = communityWallet;
        communityWallet = _communityWallet;
        // emit SetCommunityWallet(oldCommunityWallet, _communityWallet);
    }

    function setAdmin(address _admin) external onlyOwner {
        admin = _admin;
        strategy.setAdmin(_admin);
    }

    function setPendingStrategy(address _pendingStrategy) external onlyOwner {
        require(canSetPendingStrategy, "Cannot set pending strategy now");
        require(_pendingStrategy.isContract(), "New strategy is not contract");

        pendingStrategy = _pendingStrategy;
    }

    function unlockMigrateFunds() external onlyOwner {
        unlockTime = block.timestamp.add(LOCKTIME);
        canSetPendingStrategy = false;
    }

    function migrateFunds() external onlyOwner {
        require(
            unlockTime <= block.timestamp &&
                unlockTime.add(1 days) >= block.timestamp,
            "Function locked"
        );
        require(
            WETH.balanceOf(address(strategy)) > 0,
            "No balance to migrate"
        );
        require(pendingStrategy != address(0), "No pendingStrategy");
        uint256 _amount = WETH.balanceOf(address(strategy));

        WETH.safeTransferFrom(address(strategy), pendingStrategy, _amount);

        // Set new strategy
        address oldStrategy = address(strategy);
        strategy = ICitadelStrategy(pendingStrategy);
        pendingStrategy = address(0);
        canSetPendingStrategy = true;

        unlockTime = 0; // Lock back this function
        // emit MigrateFunds(oldStrategy, address(strategy), _amount);
    }

    /// return All pool in USD (6 decimals follow USDT)
    function getAllPoolInUSD() public view returns (uint256) {
        uint256 _price = _getPriceFromChainlink(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419); // ETH/USD
        return _getAllPoolInETH().mul(_price).div(1e20);
    }

    function _getAllPoolInETH() private view returns (uint256) {
        return strategy.getTotalPool().add(getVaultPoolInETH());
    }

    function getVaultPoolInETH() public view returns (uint256) {
        // Get exact USD amount of value (no decimals) 
        uint256 _totalPoolInUSD = (USDT.balanceOf(address(this)).div(1e6))
            .add(USDC.balanceOf(address(this)).div(1e6))
            .add(DAI.balanceOf(address(this)).div(1e18));
        return _totalPoolInUSD.mul(_getPriceFromChainlink(0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46)); // USDT/ETH
    }

    function _getPriceFromChainlink(address _priceFeedProxy) private view returns (uint256) {
        IChainlink pricefeed = IChainlink(_priceFeedProxy);
        (, int256 price, , ,) = pricefeed.latestRoundData();
        return uint256(price);
    }

    /// return Amount to reimburse (USDT, USDC 6 decimals, DAI 18 decimals)
    function getReimburseTokenAmount(TokenType _tokenType) public view returns (uint256) {
        uint256 _keepToken;
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
        uint256 _toKeepToken = getAllPoolInUSD().mul(_keepToken).div(DENOMINATOR);
        if (_tokenType == TokenType.DAI) {
            _toKeepToken = _toKeepToken.mul(10e11); // Follow decimals of DAI
        }
        uint256 _balanceOfToken = _token.balanceOf(address(this));
        if (_balanceOfToken < _toKeepToken) {
            return _toKeepToken.sub(_balanceOfToken);
        }
        return 0;
    }
}
