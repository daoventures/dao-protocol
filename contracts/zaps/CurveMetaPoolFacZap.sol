// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../libs/BaseRelayRecipient.sol";

interface ICurvePool {
    function coins(uint256 _index) external returns (address);
    function add_liquidity(uint256[2] memory _amounts, uint256 _amountOutMin) external returns (uint256);
    function get_virtual_price() external view returns (uint256);
}

interface ICurveZap {
    function add_liquidity(address _pool, uint256[4] memory _amounts, uint256 _amountOutMin) external returns (uint256);
    function remove_liquidity_one_coin(
        address _pool, uint256 _amount, int128 _index, uint256 _amountOutMin, address _receiver
    ) external returns (uint256);
    function calc_token_amount(address _pool, uint256[4] memory _amounts, bool _isDeposit) external returns (uint256);
}

interface IEarnVault {
    function lpToken() external view returns (address);
    function strategy() external view returns (address);
    function depositZap(uint256 _amount, address _account, bool _stake) external returns (uint256);
    function withdrawZap(uint256 _amount, address _account) external returns (uint256);
}

interface IEarnStrategy {
    function invest(uint256 _amount) external;
}

interface ISushiRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

contract CurveMetaPoolFacZap is Ownable, BaseRelayRecipient {
    using SafeERC20 for IERC20;

    struct PoolInfo {
        ICurvePool curvePool;
        IEarnStrategy strategy;
        IERC20 baseCoin;
    }
    mapping(address => PoolInfo) public poolInfos;

    ISushiRouter private constant _sushiRouter = ISushiRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    ICurveZap public constant curveZap = ICurveZap(0xA79828DF1850E8a3A3064576f380D90aECDD3359);

    IERC20 private constant _WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 private constant _3Crv = IERC20(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);
    IERC20 private constant _USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 private constant _USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 private constant _DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);

    event Deposit(address indexed vault, uint256 amount, address indexed coin, uint256 lptokenBal, uint256 daoERNBal, bool stake);
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
        _DAI.safeApprove(address(curveZap), type(uint).max);
        _USDC.safeApprove(address(curveZap), type(uint).max);
        _USDT.safeApprove(address(curveZap), type(uint).max);
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
    /// @param _stake True if stake into DAOmine
    /// @return _daoERNBal Amount of minted shares from vault contract
    function deposit(address _vault, uint256 _amount, address _coin, bool _stake) external onlyEOAOrBiconomy returns (uint256 _daoERNBal) {
        require(_amount > 0, "Amount must > 0");
        IERC20(_coin).safeTransferFrom(_msgSender(), address(this), _amount);
        _daoERNBal = _deposit(_vault, _amount, _coin, _stake);
    }

    /// @notice Function to deposit funds into vault contract after swap with Sushi
    /// @param _vault Address of vault contract to deposit
    /// @param _amount Amount of token to deposit (decimal follow token)
    /// @param _tokenAddr Address of token to deposit. Pass address(0) if deposit ETH
    /// @param _stake True if stake into DAOmine
    /// @return _daoERNBal Amount of minted shares from vault contract
    function depositZap(address _vault, uint256 _amount, address _tokenAddr, bool _stake) external payable onlyEOAOrBiconomy returns (uint256) {
        require(_amount > 0, "Amount must > 0");
        address _best = _findCurrentBest(_amount, _vault, _tokenAddr);
        uint256 _daoERNBal;
        if (_tokenAddr == address(0)) { // Deposit ETH
            address[] memory _path = new address[](2);
            _path[0] = address(_WETH);
            _path[1] = _best;
            uint256[] memory _amounts = _sushiRouter.swapExactETHForTokens{value: msg.value}(0, _path, address(this), block.timestamp);
            _daoERNBal = _deposit(_vault, _amounts[1], _best, _stake);
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
            _daoERNBal = _deposit(_vault, _amounts[2], _best, _stake);
        }
        return _daoERNBal;
    }

    /// @notice Derived function of deposit() & depositZap()
    /// @param _vault Address of vault contract to deposit
    /// @param _amount Amount of token to deposit (decimal follow token)
    /// @param _coin Address of token to deposit
    /// @param _stake True if stake into DAOmine
    /// @return _daoERNBal Amount of minted shares from vault contract
    function _deposit(address _vault, uint256 _amount, address _coin, bool _stake) private returns (uint256 _daoERNBal) {
        PoolInfo memory _poolInfo = poolInfos[_vault];
        ICurvePool _curvePool = _poolInfo.curvePool;
        uint256 _lpTokenBal;
        if (_coin == address(_3Crv)) {
            _lpTokenBal = _curvePool.add_liquidity([0, _amount], 0);
        } else {
            uint256[4] memory _amounts;
            if (_coin == address(_poolInfo.baseCoin)) {
                _amounts[0] = _amount;
            } else if (_coin == address(_USDT)) {
                _amounts[3] = _amount;
            } else if (_coin == address(_USDC)) {
                _amounts[2] = _amount;
            } else if (_coin == address(_DAI)) {
                _amounts[1] = _amount;
            } else {
                revert("Coin not acceptable");
            }
            _lpTokenBal = curveZap.add_liquidity(address(_curvePool), _amounts, 0);
        }
        _daoERNBal = IEarnVault(_vault).depositZap(_lpTokenBal, _msgSender(), _stake);
        emit Deposit(_vault, _amount, _coin, _lpTokenBal, _daoERNBal, _stake);
    }

    /// @notice Function to withdraw funds from vault contract
    /// @param _vault Address of vault contract to withdraw
    /// @param _shares Amount of user shares to surrender (18 decimals)
    /// @param _coin Address of coin to withdraw
    /// @return _coinAmount Coin amount to withdraw after remove liquidity from Curve pool (decimal follow coin)
    function withdraw(address _vault, uint256 _shares, address _coin) external returns (uint256 _coinAmount) {
        require(msg.sender == tx.origin, "Only EOA");
        PoolInfo memory _poolInfo = poolInfos[_vault];
        uint256 _lpTokenBal = IEarnVault(_vault).withdrawZap(_shares, msg.sender);
        int128 _index;
        if (_coin == address(_poolInfo.baseCoin)) {
            _index = 0;
        } else if (_coin == address(_USDT)) {
            _index = 3;
        } else if (_coin == address(_USDC)) {
            _index = 2;
        } else if (_coin == address(_DAI)) {
            _index = 1;
        } else {
            revert("Coin not acceptable");
        }
        _coinAmount = curveZap.remove_liquidity_one_coin(address(_poolInfo.curvePool), _lpTokenBal, _index, 0, msg.sender);
        emit Withdraw(_vault, _shares, _coin, _lpTokenBal, _coinAmount);
    }

    /// @notice Function to swap fees from vault contract (and transfer back to vault contract)
    /// @param _amount Amount of LP token to be swapped (18 decimals)
    /// @return Amount and address of coin to receive (amount follow decimal of coin)
    function swapFees(uint256 _amount) external returns (uint256, address) {
        address _curvePoolAddr = address(poolInfos[msg.sender].curvePool);
        require(_curvePoolAddr != address(0), "Only authorized vault");
        IERC20(IEarnVault(msg.sender).lpToken()).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _coinAmount = curveZap.remove_liquidity_one_coin(_curvePoolAddr, _amount, 3, 0, msg.sender);
        emit SwapFees(_amount, _coinAmount, address(_USDT));
        return (_coinAmount, address(_USDT));
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
        _WETH.safeTransferFrom(address(_poolInfo.strategy), address(this), _amount);
        // Swap WETH to coin which can provide highest LP token return
        address _best = _findCurrentBest(_amount, _vault, address(0));
        address[] memory _path = new address[](2);
        _path[0] = address(_WETH);
        _path[1] = _best;
        uint256[] memory _amountsOut = _sushiRouter.swapExactTokensForTokens(_amount, 0, _path, address(this), block.timestamp);
        // Add coin into Curve pool
        uint256[4] memory _amounts;
        if (_best == address(_poolInfo.baseCoin)) {
            _amounts[0] = _amountsOut[1];
        } else if (_best == address(_DAI)) {
            _amounts[1] = _amountsOut[1];
        } else if (_best == address(_USDC)) {
            _amounts[2] = _amountsOut[1];
        } else { // address(_USDT)
            _amounts[3] = _amountsOut[1];
        }
        _lpTokenBal = curveZap.add_liquidity(address(_poolInfo.curvePool), _amounts, 0);
        emit AddLiquidity(_amount, _vault, _best, _lpTokenBal);
    }

    /// @notice Same function as compound() but transfer received LP token to vault instead of strategy contract
    /// @param _amount Amount to emergency withdraw in WETH
    /// @param _vault Address of vault contract
    function emergencyWithdraw(uint256 _amount, address _vault) external {
        require(msg.sender == address(poolInfos[_vault].strategy), "Only authorized strategy");
        uint256 _lpTokenBal = _addLiquidity(_amount, _vault);
        IERC20(IEarnVault(_vault).lpToken()).safeTransfer(_vault, _lpTokenBal);
        emit EmergencyWithdraw(_amount, _vault, _lpTokenBal);
    }

    /// @notice Function to find coin that provide highest LP token return
    /// @param _amount Amount of WETH to be calculate
    /// @param _vault Address of vault contract
    /// @param _token Input token address to be calculate
    /// @return Coin address that provide highest LP token return
    function _findCurrentBest(uint256 _amount, address _vault, address _token) private returns (address) {
        address _baseCoin = address(poolInfos[_vault].baseCoin);
        // Get estimated amount out of LP token for each input token
        uint256 _amountOut = _calcAmountOut(_amount, _token, address(_DAI), _vault);
        uint256 _amountOutUSDC = _calcAmountOut(_amount, _token, address(_USDC), _vault);
        uint256 _amountOutUSDT = _calcAmountOut(_amount, _token, address(_USDT), _vault);
        uint256 _amountOutBase = _calcAmountOut(_amount, _token, _baseCoin, _vault);
        // Compare for highest LP token out among coin address
        address _best = address(_DAI);
        if (_amountOutUSDC > _amountOut) {
            _best = address(_USDC);
            _amountOut = _amountOutUSDC;
        }
        if (_amountOutUSDT > _amountOut) {
            _best = address(_USDT);
            _amountOut = _amountOutUSDT;
        }
        if (_amountOutBase > _amountOut) {
            _best = _baseCoin;
        }
        return _best;
    }

    /// @notice Function to calculate amount out of LP token
    /// @param _amount Amount of WETH to be calculate
    /// @param _vault Address of vault contract to retrieve pool
    /// @param _token Input token address to be calculate (for depositZap(), otherwise address(0))
    /// @return Amount out of LP token
    function _calcAmountOut(uint256 _amount, address _token, address _coin, address _vault) private returns (uint256) {
        uint256 _amountOut;
        if (_token == address(0)) { // From _addLiquidity()
            address[] memory _path = new address[](2);
            _path[0] = address(_WETH);
            _path[1] = _coin;
            _amountOut = (_sushiRouter.getAmountsOut(_amount, _path))[1];
        } else { // From depositZap()
            address[] memory _path = new address[](3);
            _path[0] = _token;
            _path[1] = address(_WETH);
            _path[2] = _coin;
            _amountOut = (_sushiRouter.getAmountsOut(_amount, _path))[2];
        }

        PoolInfo memory _poolInfo = poolInfos[_vault];
        uint256[4] memory _amounts;
        if (_coin == address(_poolInfo.baseCoin)) {
            _amounts[0] = _amountOut;
        } else if (_coin == address(_DAI)) {
            _amounts[1] = _amountOut;
        } else if (_coin == address(_USDC)) {
            _amounts[2] = _amountOut;
        } else { // address(_USDT)
            _amounts[3] = _amountOut;
        }
        return curveZap.calc_token_amount(address(_poolInfo.curvePool), _amounts, true);
    }

    /// @notice Function to add new Curve pool (for Curve metapool with factory deposit zap only)
    /// @param vault_ Address of corresponding vault contract
    /// @param curvePool_ Address of Curve metapool contract
    function addPool(address vault_, address curvePool_) external onlyOwner {
        IEarnVault _vault = IEarnVault(vault_);
        IERC20 _lpToken = IERC20(_vault.lpToken());
        ICurvePool _curvePool = ICurvePool(curvePool_);
        IERC20 _baseCoin = IERC20(_curvePool.coins(0)); // Base coin is the coin other than USDT/USDC/DAI in Curve metapool
        address _strategy = _vault.strategy();

        _lpToken.safeApprove(vault_, type(uint).max);
        _lpToken.safeApprove(_strategy, type(uint).max);
        _lpToken.safeApprove(address(curveZap), type(uint).max);
        _3Crv.safeApprove(curvePool_, type(uint).max);
        _baseCoin.safeApprove(address(curveZap), type(uint).max);
        _baseCoin.safeApprove(curvePool_, type(uint).max);

        poolInfos[vault_] = PoolInfo(
            _curvePool,
            IEarnStrategy(_strategy),
            _baseCoin
        );
        emit AddPool(vault_, curvePool_, address(curveZap));
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