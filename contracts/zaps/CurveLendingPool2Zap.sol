// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../libs/BaseRelayRecipient.sol";

interface ICurvePool {
    function coins(uint256 _index) external returns (address);
    function underlying_coins(uint256 _index) external returns (address);
    function add_liquidity(uint256[2] memory _amounts, uint256 _amountOutMin, bool _useUnderlying) external returns (uint256);
    function remove_liquidity_one_coin(uint256 _amount, int128 _index, uint256 _amountOutMin, bool _useUnderlying) external returns (uint256);
    function calc_token_amount(uint256[2] memory _amounts, bool _isDeposit) external returns (uint256);
    function get_virtual_price() external view returns (uint256);
    function lp_token() external view returns (address);
}

interface IEarnVault {
    function strategy() external view returns (address);
    function depositZap(uint256 _amount, address _account) external;
    function withdrawZap(uint256 _amount, address _account) external returns (uint256);
}

interface IEarnStrategy {
    function invest(uint256 _amount) external;
}

interface ISushiRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

contract CurveLendingPool2Zap is Ownable, BaseRelayRecipient {
    using SafeERC20 for IERC20;

    struct PoolInfo {
        ICurvePool curvePool;
        IEarnStrategy strategy;
        address[] coins;
        address[] underlying;
    }
    mapping(address => PoolInfo) public poolInfos;

    ISushiRouter private constant _sushiRouter = ISushiRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);

    IERC20 private constant _WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    event Deposit(address indexed vault, uint256 amount, address indexed coin, uint256 lptokenBal);
    event Withdraw(address indexed vault, uint256 shares, address indexed coin, uint256 lptokenBal, uint256 coinAmount);
    event SwapFees(uint256 amount, uint256 coinAmount, address indexed coin);
    event Compound(uint256 amount, address indexed vault, uint256 lpTokenBal);
    event AddLiquidity(uint256 amount, address indexed vault, address indexed best, uint256 lpTokenBal);
    event EmergencyWithdraw(uint256 amount, address indexed vault, uint256 lpTokenBal);
    event AddPool(address indexed vault, address indexed curvePool, address indexed curveZap);
    event SetStrategy(address indexed strategy);
    event SetBiconomy(address indexed biconomy);

    modifier onlyEOAOrBiconomy {
        require(msg.sender == tx.origin || isTrustedForwarder(msg.sender), "Only EOA or Biconomy");
        _;
    }

    constructor() {
        _WETH.safeApprove(address(_sushiRouter), type(uint).max);
    }

    /// @notice Function that required for inherit BaseRelayRecipient
    function _msgSender() internal override(Context, BaseRelayRecipient) view returns (address) {
        return BaseRelayRecipient._msgSender();
    }
    
    /// @notice Function that required for inherit BaseRelayRecipient
    function versionRecipient() external pure override returns (string memory) {
        return "1";
    }

    /// @notice Function to deposit funds into vault contract
    /// @param _vault Address of vault contract to deposit
    /// @param _amount Amount of token to deposit (decimal follow token)
    /// @param _coin Address of token to deposit
    /// @return _lpTokenBal LP token amount to deposit after add liquidity to Curve pool (18 decimals)
    function deposit(address _vault, uint256 _amount, address _coin) external onlyEOAOrBiconomy returns (uint256 _lpTokenBal) {
        require(_amount > 0, "Amount must > 0");
        IERC20(_coin).safeTransferFrom(_msgSender(), address(this), _amount);
        _lpTokenBal = _deposit(_vault, _amount, _coin);
    }

    /// @notice Function to deposit funds into vault contract after swap with Sushi
    /// @param _vault Address of vault contract to deposit
    /// @param _amount Amount of token to deposit (decimal follow token)
    /// @param _tokenAddr Address of token to deposit. Pass address(0) if deposit ETH
    /// @return LP token amount to deposit after add liquidity to Curve pool (18 decimals)
    function depositZap(address _vault, uint256 _amount, address _tokenAddr) external payable onlyEOAOrBiconomy returns (uint256) {
        require(_amount > 0, "Amount must > 0");
        address _best = _findCurrentBest(_amount, _vault, _tokenAddr);
        uint256 _lpTokenBal;
        if (_tokenAddr == address(0)) { // Deposit ETH
            address[] memory _path = new address[](2);
            _path[0] = address(_WETH);
            _path[1] = _best;
            uint256[] memory _amounts = _sushiRouter.swapExactETHForTokens{value: msg.value}(0, _path, address(this), block.timestamp);
            _lpTokenBal = _deposit(_vault, _amounts[1], _best);
        } else {
            IERC20 _token = IERC20(_tokenAddr);
            _token.safeTransferFrom(_msgSender(), address(this), _amount);
            if (_token.allowance(address(this), address(_sushiRouter)) == 0) {
                _token.safeApprove(address(_sushiRouter), type(uint256).max);
            }
            address[] memory _path = new address[](3);
            _path[0] = _tokenAddr;
            _path[1] = address(_WETH);
            _path[2] = _best;
            uint256[] memory _amounts = _sushiRouter.swapExactTokensForTokens(_amount, 0, _path, address(this), block.timestamp);
            _lpTokenBal = _deposit(_vault, _amounts[2], _best);
        }
        return _lpTokenBal;
    }

    /// @notice Derived function of deposit() & depositZap()
    /// @param _vault Address of vault contract to deposit
    /// @param _amount Amount of token to deposit (decimal follow token)
    /// @param _coin Address of token to deposit
    /// @return _lpTokenBal LP token amount to deposit after add liquidity to Curve pool (18 decimals)
    function _deposit(address _vault, uint256 _amount, address _coin) private returns (uint256) {
        PoolInfo memory _poolInfo = poolInfos[_vault];
        ICurvePool _curvePool = _poolInfo.curvePool;
        address[] memory _coins = _poolInfo.coins;
        address[] memory _underlying = _poolInfo.underlying;
        uint256[2] memory _amounts;
        uint256 _lpTokenBal;
        if (_coin == address(_coins[0]) || _coin == address(_coins[1])) {
            _amounts[0] = _coin == address(_coins[0]) ? _amount : 0;
            _amounts[1] = _coin == address(_coins[1]) ? _amount : 0;
            _lpTokenBal = _curvePool.add_liquidity(_amounts, 0, false);
        } else if (_coin == address(_underlying[0]) || _coin == address(_underlying[1])) {
            _amounts[0] = _coin == address(_underlying[0]) ? _amount : 0;
            _amounts[1] = _coin == address(_underlying[1]) ? _amount : 0;
            _lpTokenBal = _curvePool.add_liquidity(_amounts, 0, true);
        } else {
            revert("Coin not acceptable");
        }
        IEarnVault(_vault).depositZap(_lpTokenBal, _msgSender());
        emit Deposit(_vault, _amount, _coin, _lpTokenBal);
        return _lpTokenBal;
    }

    /// @notice Function to withdraw funds from vault contract
    /// @param _vault Address of vault contract to withdraw
    /// @param _shares Amount of user shares to surrender (18 decimals)
    /// @param _coin Address of coin to withdraw
    /// @return _coinAmount Coin amount to withdraw after remove liquidity from Curve pool (decimal follow coin)
    function withdraw(address _vault, uint256 _shares, address _coin) external returns (uint256 _coinAmount) {
        require(msg.sender == tx.origin, "Only EOA");
        PoolInfo memory _poolInfo = poolInfos[_vault];
        address[] memory _underlying = _poolInfo.underlying;
        require(_coin == _underlying[0] || _coin == _underlying[1], "Only authorized coin");
        uint256 _lpTokenBal = IEarnVault(_vault).withdrawZap(_shares, msg.sender);
        int128 _index;
        if (_coin == _underlying[0]) {_index = 0;}
        else if (_coin == _underlying[1]) {_index = 1;}
        _coinAmount = _poolInfo.curvePool.remove_liquidity_one_coin(_lpTokenBal, _index, 0, true);
        IERC20(_coin).safeTransfer(msg.sender, _coinAmount);
        emit Withdraw(_vault, _shares, _coin, _lpTokenBal, _coinAmount);
    }

    /// @notice Function to swap fees from vault contract (and transfer back to vault contract)
    /// @param _amount Amount of LP token to be swapped (18 decimals)
    /// @return Amount and address of coin to receive (amount follow decimal of coin)
    function swapFees(uint256 _amount) external returns (uint256, address) {
        PoolInfo memory _poolInfo = poolInfos[msg.sender];
        ICurvePool _curvePool = _poolInfo.curvePool;
        require(address(_curvePool) != address(0), "Only authorized vault");
        IERC20 lpToken = IERC20(_curvePool.lp_token());
        lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        IERC20 _DAI = IERC20(_poolInfo.underlying[0]);
        uint256 _coinAmount = _curvePool.remove_liquidity_one_coin(_amount, 0, 0, true);
        _DAI.safeTransfer(msg.sender, _coinAmount);
        emit SwapFees(_amount, _coinAmount, address(_DAI));
        return (_coinAmount, address(_DAI));
    }

    /// @notice Function to swap WETH from strategy contract (and invest into strategy contract)
    /// @param _amount Amount to compound in WETH
    /// @param _vault Address of vault contract to retrieve strategy contract
    /// @return _lpTokenBal LP token amount to invest after add liquidity to Curve pool (18 decimals)
    function compound(uint256 _amount, address _vault) external returns (uint256 _lpTokenBal) {
        IEarnStrategy _strategy = poolInfos[_vault].strategy;
        require(msg.sender == address(_strategy), "Only authorized strategy");
        _lpTokenBal = _addLiquidity(_amount, _vault);
        _strategy.invest(_lpTokenBal);
        emit Compound(_amount, _vault, _lpTokenBal);
    }

    /// @notice Function to swap WETH and add liquidity into Curve pool
    /// @param _amount Amount of WETH to swap and add into Curve pool
    /// @param _vault Address of vault contract to determine pool
    /// @return _lpTokenBal LP token amount received after add liquidity into Curve pool (18 decimals)
    function _addLiquidity(uint256 _amount, address _vault) private returns (uint256 _lpTokenBal) {
        PoolInfo memory _poolInfo = poolInfos[_vault];
                address[] memory _underlying = _poolInfo.underlying;
        _WETH.safeTransferFrom(address(_poolInfo.strategy), address(this), _amount);
        // Swap WETH to coin which can provide highest LP token return
        address _best = _findCurrentBest(_amount, _vault, address(0));
        address[] memory _path = new address[](2);
        _path[0] = address(_WETH);
        _path[1] = _best;
        uint256[] memory _amountsOut = _sushiRouter.swapExactTokensForTokens(_amount, 0, _path, address(this), block.timestamp);
        // Add coin into Curve pool
        uint256[2] memory _amounts;
        _amounts[0] = _best == address(_underlying[0]) ? _amountsOut[1] : 0;
        _amounts[1] = _best == address(_underlying[1]) ? _amountsOut[1] : 0;
        _lpTokenBal = _poolInfo.curvePool.add_liquidity(_amounts, 0, true);
        emit AddLiquidity(_amount, _vault, _best, _lpTokenBal);
    }

    /// @notice Same function as compound() but transfer received LP token to vault instead of strategy contract
    /// @param _amount Amount to emergency withdraw in WETH
    /// @param _vault Address of vault contract
    function emergencyWithdraw(uint256 _amount, address _vault) external {
        PoolInfo memory _poolInfo = poolInfos[_vault];
        require(msg.sender == address(_poolInfo.strategy), "Only authorized strategy");
        uint256 _lpTokenBal = _addLiquidity(_amount, _vault);
        IERC20(_poolInfo.curvePool.lp_token()).safeTransfer(_vault, _lpTokenBal);
        emit EmergencyWithdraw(_amount, _vault, _lpTokenBal);
    }

    /// @notice Function to find coin that provide highest LP token return
    /// @param _amount Amount of WETH to be calculate
    /// @param _vault Address of vault contract
    /// @param _token Input token address to be calculate
    /// @return Coin address that provide highest LP token return
    function _findCurrentBest(uint256 _amount, address _vault, address _token) private returns (address) {
        address[] memory _underlying = poolInfos[_vault].underlying;
        // Get estimated amount out of LP token for each input token
        uint256 _amountOut = _calcAmountOut(_amount, _token, _underlying[0], _vault);
        uint256 _amountOut1 = _calcAmountOut(_amount, _token, _underlying[1], _vault);
        // Compare for highest LP token out among coin address
        return _amountOut1 > _amountOut ? _underlying[1] : _underlying[0];
    }

    /// @notice Function to calculate amount out of LP token
    /// @param _amount Amount of WETH to be calculate
    /// @param _vault Address of vault contract to retrieve pool
    /// @param _token Input token address to be calculate (for depositZap(), otherwise address(0))
    /// @return Amount out of LP token
    function _calcAmountOut(uint256 _amount, address _token, address _coin, address _vault) private returns (uint256) {
        uint256[] memory _amountsOut;
        uint256 _amountOut;
        if (_token == address(0)) { // From _addLiquidity()
            address[] memory _path = new address[](2);
            _path[0] = address(_WETH);
            _path[1] = _coin;
            _amountsOut = _sushiRouter.getAmountsOut(_amount, _path);
            _amountOut = _amountsOut[1];
        } else { // From depositZap()
            address[] memory _path = new address[](3);
            _path[0] = _token;
            _path[1] = address(_WETH);
            _path[2] = _coin;
            _amountsOut = _sushiRouter.getAmountsOut(_amount, _path);
            _amountOut = _amountsOut[2];
        }

        PoolInfo memory _poolInfo = poolInfos[_vault];
        address[] memory _underlying = _poolInfo.underlying;
        uint256[2] memory _amounts;
        _amounts[0] = _coin == address(_underlying[0]) ? _amountOut : 0;
        _amounts[1] = _coin == address(_underlying[1]) ? _amountOut : 0;
        return _poolInfo.curvePool.calc_token_amount(_amounts, true);
    }

    /// @notice Function to add new Curve pool (for Curve metapool with factory deposit zap only)
    /// @param vault_ Address of corresponding vault contract
    /// @param curvePool_ Address of Curve metapool contract
    /// @param curveZap_ Address of Curve metapool factory deposit zap contract
    function addPool(address vault_, address curvePool_, address curveZap_) external onlyOwner {
        IEarnVault _vault = IEarnVault(vault_);
        ICurvePool _curvePool = ICurvePool(curvePool_);
        address _strategy = _vault.strategy();
        
        address[] memory _coins = new address[](2);
        for (uint256 _i; _i < 2; _i++) {
            address _coin = _curvePool.coins(_i);
            IERC20(_coin).safeApprove(curvePool_, type(uint).max);
            _coins[_i] = _coin;
        }

        address[] memory _underlying = new address[](2);
        for (uint256 _i; _i < 2; _i++) {
            address underlying_ = _curvePool.underlying_coins(_i);
            IERC20(underlying_).safeApprove(curvePool_, type(uint).max);
            _underlying[_i] = underlying_;
        }

        IERC20 _lpToken = IERC20(_curvePool.lp_token());
        _lpToken.safeApprove(vault_, type(uint).max);
        _lpToken.safeApprove(_strategy, type(uint).max);

        poolInfos[vault_] = PoolInfo(
            _curvePool,
            IEarnStrategy(_strategy),
            _coins,
            _underlying
        );
        emit AddPool(vault_, curvePool_, curveZap_);
    }
    
    /// @notice Function to set new strategy contract
    /// @param _strategy Address of new strategy contract
    function setStrategy(address _strategy) external {
        require(address(poolInfos[msg.sender].strategy) != address(0), "Only authorized vault");
        poolInfos[msg.sender].strategy = IEarnStrategy(_strategy);
        emit SetStrategy(_strategy);
    }

    /// @notice Function to set new trusted forwarder contract (Biconomy)
    /// @param _biconomy Address of new trusted forwarder contract
    function setBiconomy(address _biconomy) external onlyOwner {
        trustedForwarder = _biconomy;
        emit SetBiconomy(_biconomy);
    }

    /// @notice Function to get LP token price
    /// @return LP token price of corresponding Curve pool (18 decimals)
    function getVirtualPrice() external view returns (uint256) {
        return poolInfos[msg.sender].curvePool.get_virtual_price();
    }

    /// @notice Function to check token availability to depositZap()
    /// @param _amount Amount to be swapped (decimals follow _tokenIn)
    /// @param _tokenIn Address to be swapped
    /// @param _tokenOut Address to be received (Stablecoin)
    /// @return Amount out in USD. Token not available if return 0.
    function checkTokenSwapAvailability(uint256 _amount, address _tokenIn, address _tokenOut) external view returns (uint256) {
        address[] memory _path = new address[](3);
        _path[0] = _tokenIn;
        _path[1] = address(_WETH);
        _path[2] = _tokenOut;
        try _sushiRouter.getAmountsOut(_amount, _path) returns (uint256[] memory _amountsOut){
            return _amountsOut[2];
        } catch {
            return 0;
        }
    }
}