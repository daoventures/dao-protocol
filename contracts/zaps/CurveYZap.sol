// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../libs/BaseRelayRecipient.sol";

interface ICurvePool {
    function add_liquidity(uint256[4] memory _amounts, uint256 _amountOutMin) external;
    function calc_token_amount(uint256[4] memory _amounts, bool _isDeposit) external returns (uint256);
	function get_virtual_price() external view returns (uint256);
}

interface ICurveZap {
    function add_liquidity(uint256[4] memory _amounts, uint256 _amountOutMin) external;
	function remove_liquidity_one_coin(uint256 _amount, int128 _index, uint256 _amountOutMin) external;
	function token() external view returns (address);
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

contract CurveYZap is Ownable, BaseRelayRecipient {
    using SafeERC20 for IERC20;

    ISushiRouter private constant _sushiRouter = ISushiRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
	ICurvePool public constant curvePool = ICurvePool(0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51);
	ICurveZap public constant curveZap = ICurveZap(0xbBC81d23Ea2c3ec7e56D39296F0cbB648873a5d3);
	IEarnStrategy public strategy;
	IEarnVault public vault;

    IERC20 private constant _WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 private constant _DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 private constant _USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 private constant _USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 private constant _TUSD = IERC20(0x0000000000085d4780B73119b644AE5ecd22b376);
    IERC20 private constant _yDAI = IERC20(0x16de59092dAE5CcF4A1E6439D611fd0653f0Bd01);
    IERC20 private constant _yUSDC = IERC20(0xd6aD7a6750A7593E092a9B218d66C0A814a3436e);
	IERC20 private constant _yUSDT = IERC20(0x83f798e925BcD4017Eb265844FDDAbb448f1707D);
    IERC20 private constant _yTUSD = IERC20(0x73a052500105205d34Daf004eAb301916DA8190f);
	IERC20 private constant _lpToken = IERC20(0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8);

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
		address _best = _findCurrentBest(_amount, _tokenAddr);
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
		uint256 _lpTokenBal;
		uint256[4] memory _amounts;
		if (_coin == address(_DAI) || _coin == address(_USDC) || _coin == address(_USDT) || _coin == address(_TUSD)) {
			_amounts[0] = _coin == address(_DAI) ? _amount : 0;
			_amounts[1] = _coin == address(_USDC) ? _amount : 0;
			_amounts[2] = _coin == address(_USDT) ? _amount : 0;
			_amounts[3] = _coin == address(_TUSD) ? _amount : 0;
			curveZap.add_liquidity(_amounts, 0);
			_lpTokenBal = _lpToken.balanceOf(address(this));
		}
		else if (_coin == address(_yDAI) || _coin == address(_yUSDC) || _coin == address(_yUSDT) || _coin == address(_yTUSD)) {
			_amounts[0] = _coin == address(_yDAI) ? _amount : 0;
			_amounts[1] = _coin == address(_yUSDC) ? _amount : 0;
			_amounts[2] = _coin == address(_yUSDT) ? _amount : 0;
			_amounts[3] = _coin == address(_yTUSD) ? _amount : 0;
			curvePool.add_liquidity(_amounts, 0);
			_lpTokenBal = _lpToken.balanceOf(address(this));
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
		require(
			_coin == address(_DAI) ||
			_coin == address(_USDC) ||
			_coin == address(_USDT) ||
			_coin == address(_TUSD),
			"Only authorized coin"
		);
		uint256 _lpTokenBal = vault.withdrawZap(_shares, msg.sender);
		int128 _index = 2; // USDT
		if (_coin == address(_DAI)) {_index = 0;}
		else if (_coin == address(_USDC)) {_index = 1;}
		else if (_coin == address(_TUSD)) {_index = 3;}
		curveZap.remove_liquidity_one_coin(_lpTokenBal, _index, 0);
		IERC20 coin_ = IERC20(_coin);
		_coinAmount = coin_.balanceOf(address(this));
		coin_.safeTransfer(msg.sender, _coinAmount);
		emit Withdraw(_vault, _shares, _coin, _lpTokenBal, _coinAmount);
	}

	/// @notice Function to swap fees from vault contract (and transfer back to vault contract)
	/// @param _amount Amount of LP token to be swapped (18 decimals)
	/// @return Amount and address of coin to receive (amount follow decimal of coin)
	function swapFees(uint256 _amount) external returns (uint256, address) {
		require(msg.sender == address(vault), "Only authorized vault");
		_lpToken.safeTransferFrom(msg.sender, address(this), _amount);
		curveZap.remove_liquidity_one_coin(_amount, 2, 0);
		uint256 _coinAmount = _USDT.balanceOf(address(this));
		_USDT.safeTransfer(msg.sender, _coinAmount);
		emit SwapFees(_amount, _coinAmount, address(_USDT));
		return (_coinAmount, address(_USDT));
	}

	/// @notice Function to swap WETH from strategy contract (and invest into strategy contract)
	/// @param _amount Amount to compound in WETH
	/// @param _vault Address of vault contract to retrieve strategy contract
	/// @return _lpTokenBal LP token amount to invest after add liquidity to Curve pool (18 decimals)
    function compound(uint256 _amount, address _vault) external returns (uint256 _lpTokenBal) {
		require(msg.sender == address(strategy), "Only authorized strategy");
		_lpTokenBal = _addLiquidity(_amount, _vault);
		strategy.invest(_lpTokenBal);
		emit Compound(_amount, _vault, _lpTokenBal);
    }

	/// @notice Function to swap WETH and add liquidity into Curve pool
	/// @param _amount Amount of WETH to swap and add into Curve pool
	/// @param _vault Address of vault contract to determine pool
	/// @return _lpTokenBal LP token amount received after add liquidity into Curve pool (18 decimals)
	function _addLiquidity(uint256 _amount, address _vault) private returns (uint256 _lpTokenBal) {
		_WETH.safeTransferFrom(address(strategy), address(this), _amount);
		// Swap WETH to coin which can provide highest LP token return
		address _best = _findCurrentBest(_amount, address(0));
		address[] memory _path = new address[](2);
		_path[0] = address(_WETH);
		_path[1] = _best;
		uint256[] memory _amountsOut = _sushiRouter.swapExactTokensForTokens(_amount, 0, _path, address(this), block.timestamp);
		// Add coin into Curve pool
		uint256[4] memory _amounts;
		_amounts[0] = _best == address(_DAI) ? _amountsOut[1] : 0;
		_amounts[1] = _best == address(_USDC) ? _amountsOut[1] : 0;
		_amounts[2] = _best == address(_USDT) ? _amountsOut[1] : 0;
		_amounts[3] = _best == address(_TUSD) ? _amountsOut[1] : 0;
		curveZap.add_liquidity(_amounts, 0);
		_lpTokenBal = _lpToken.balanceOf(address(this));
		emit AddLiquidity(_amount, _vault, _best, _lpTokenBal);
	}

	/// @notice Same function as compound() but transfer received LP token to vault instead of strategy contract
	/// @param _amount Amount to emergency withdraw in WETH
	/// @param _vault Address of vault contract
	function emergencyWithdraw(uint256 _amount, address _vault) external {
		require(msg.sender == address(strategy), "Only authorized strategy");
		uint256 _lpTokenBal = _addLiquidity(_amount, _vault);
		IERC20(curveZap.token()).safeTransfer(_vault, _lpTokenBal);
		emit EmergencyWithdraw(_amount, _vault, _lpTokenBal);
	}

	/// @notice Function to find coin that provide highest LP token return
	/// @param _amount Amount of WETH to be calculate
	/// @param _token Input token address to be calculate
	/// @return Coin address that provide highest LP token return
	function _findCurrentBest(uint256 _amount, address _token) private returns (address) {
		// Get estimated amount out of LP token for each input token
		uint256 _amountOut = _calcAmountOut(_amount, _token, address(_DAI));
		uint256 _amountOutUSDC = _calcAmountOut(_amount, _token, address(_USDC));
		uint256 _amountOutUSDT = _calcAmountOut(_amount, _token, address(_USDT));
		uint256 _amountOutTUSD = _calcAmountOut(_amount, _token, address(_TUSD));
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
		if (_amountOutTUSD > _amountOut) {
			_best = address(_TUSD);
		}
		return _best;
	}

	/// @notice Function to calculate amount out of LP token
	/// @param _amount Amount of WETH to be calculate
	/// @param _token Input token address to be calculate (for depositZap(), otherwise address(0))
	/// @return Amount out of LP token
	function _calcAmountOut(uint256 _amount, address _token, address _coin) private returns (uint256) {
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

		uint256[4] memory _amounts;
		_amounts[0] = _coin == address(_DAI) ? _amountOut : 0;
		_amounts[1] = _coin == address(_USDC) ? _amountOut : 0;
		_amounts[2] = _coin == address(_USDT) ? _amountOut : 0;
		_amounts[3] = _coin == address(_TUSD) ? _amountOut : 0;
		return curvePool.calc_token_amount(_amounts, true);
	}

	/// @notice Function to add new Curve pool (for Curve metapool with factory deposit zap only)
	/// @param vault_ Address of corresponding vault contract
	/// @param curvePool_ Address of Curve metapool contract
	/// @param curveZap_ Address of Curve metapool factory deposit zap contract
	function addPool(address vault_, address curvePool_, address curveZap_) external onlyOwner {
		vault = IEarnVault(vault_);
		strategy = IEarnStrategy(vault.strategy());

		_lpToken.safeApprove(vault_, type(uint).max);
		_lpToken.safeApprove(address(strategy), type(uint).max);
		_lpToken.safeApprove(curveZap_, type(uint).max);
		_DAI.safeApprove(curveZap_, type(uint).max);
		_USDC.safeApprove(curveZap_, type(uint).max);
		_USDT.safeApprove(curveZap_, type(uint).max);
		_TUSD.safeApprove(curveZap_, type(uint).max);
		_yDAI.safeApprove(curvePool_, type(uint).max);
		_yUSDC.safeApprove(curvePool_, type(uint).max);
		_yUSDT.safeApprove(curvePool_, type(uint).max);
		_yTUSD.safeApprove(curvePool_, type(uint).max);

		emit AddPool(vault_, curvePool_, curveZap_);
	}
    
	/// @notice Function to set new strategy contract
	/// @param _strategy Address of new strategy contract
	function setStrategy(address _strategy) external {
		require(msg.sender == address(vault), "Only authorized vault");
		strategy = IEarnStrategy(_strategy);
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
		return curvePool.get_virtual_price();
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