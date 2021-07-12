// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

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
    function add_liquidity(uint256[4] memory _amounts, uint256 _amountOutMin) external returns (uint256);
	function remove_liquidity_one_coin(uint256 _amount, int128 _index, uint256 _amountOutMin) external returns (uint256);
    function calc_token_amount(uint256[4] memory _amounts, bool _isDeposit) external returns (uint256);
}

interface IEarnVault {
	function lpToken() external view returns (address);
    function strategy() external view returns (address);
    function deposit(uint256 _amount, address _account) external;
    function withdraw(uint256 _amount, address _account) external returns (uint256);
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

contract CurveMetaPoolZapIndividual is Ownable, BaseRelayRecipient {
    using SafeERC20 for IERC20;

	struct PoolInfo {
		ICurvePool curvePool;
		ICurveZap curveZap;
		IEarnStrategy strategy;
    	IERC20 baseToken;
	}
	mapping(address => PoolInfo) public poolInfos;

    ISushiRouter private constant _sushiRouter = ISushiRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);

    IERC20 private constant _WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 private constant _3Crv = IERC20(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);
    IERC20 private constant _USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 private constant _USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 private constant _DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);

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

    function deposit(address _vault, uint256 _amount, address _coin) external onlyEOAOrBiconomy returns (uint256 _lpTokenBal) {
		require(
			_coin == address(_DAI) ||
			_coin == address(_USDC) ||
			_coin == address(_USDT) ||
			_coin == address(poolInfos[_vault].baseToken) ||
			_coin == address(_3Crv),
			"Only authorized coin"
		);
		require(_amount > 0, "Amount must > 0");
		IERC20(_coin).safeTransferFrom(_msgSender(), address(this), _amount);
		_lpTokenBal = _deposit(_vault, _amount, _coin);
    }

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

	function _deposit(address _vault, uint256 _amount, address _coin) private returns (uint256) {
		PoolInfo memory _poolInfo = poolInfos[_vault];
		ICurvePool _curvePool = _poolInfo.curvePool;
		uint256 _lpTokenBal;
		if (_coin == address(_DAI) || _coin == address(_USDC) || _coin == address(_USDT)) {
			uint256[4] memory _amounts;
			_amounts[0] = 0;
			_amounts[1] = _coin == address(_DAI) ? _amount : 0;
			_amounts[2] = _coin == address(_USDC) ? _amount : 0;
			_amounts[3] = _coin == address(_USDT) ? _amount : 0;
			_lpTokenBal = _poolInfo.curveZap.add_liquidity(_amounts, 0);
		}
		if (_coin == address(_poolInfo.baseToken) || _coin == address(_3Crv)) {
			uint256[2] memory _amounts;
			_amounts[0] = _coin == address(_poolInfo.baseToken) ? _amount : 0;
			_amounts[1] = _coin == address(_3Crv) ? _amount : 0;
			_lpTokenBal = _curvePool.add_liquidity(_amounts, 0);
		}
		IEarnVault(_vault).deposit(_lpTokenBal, _msgSender());
		return _lpTokenBal;
	}

	function withdraw(address _vault, uint256 _shares, address _coin) external returns (uint256 _coinAmount) {
		require(msg.sender == tx.origin, "Only EOA");
		PoolInfo memory _poolInfo = poolInfos[_vault];
		address _baseToken = address(_poolInfo.baseToken);
		require(
			_coin == address(_DAI) ||
			_coin == address(_USDC) ||
			_coin == address(_USDT) ||
			_coin == _baseToken,
			"Only authorized coin"
		);
		uint256 _lpTokenBal = IEarnVault(_vault).withdraw(_shares, msg.sender);
		int128 _index = 3;
		if (_coin == _baseToken) {_index = 0;}
		else if (_coin == address(_DAI)) {_index = 1;}
		else if (_coin == address(_USDC)) {_index = 2;}
		_coinAmount = _poolInfo.curveZap.remove_liquidity_one_coin(_lpTokenBal, _index, 0);
		IERC20(_coin).safeTransfer(msg.sender, _coinAmount);
	}

	function swapFees(uint256 _amount) external returns (uint256, address) {
		PoolInfo memory _poolInfo = poolInfos[msg.sender];
		address _curvePoolAddr = address(_poolInfo.curvePool);
		require(_curvePoolAddr != address(0), "Not authorized vault");
		IERC20(IEarnVault(msg.sender).lpToken()).safeTransferFrom(msg.sender, address(this), _amount);
		uint256 _coinAmount = _poolInfo.curveZap.remove_liquidity_one_coin(_amount, 3, 0);
		_USDT.safeTransfer(msg.sender, _coinAmount);
		return (_coinAmount, address(_USDT));
	}

	/// @param _amount Amount to compound in WETH
    function compound(uint256 _amount, address _vault) external returns (uint256 _lpTokenBal) {
		IEarnStrategy _strategy = poolInfos[_vault].strategy;
		require(msg.sender == address(_strategy), "Not authorized strategy");
		_lpTokenBal = _addLiquidity(_amount, _vault);
		_strategy.invest(_lpTokenBal);
    }

	/// @param _amount Amount of WETH to swap and add into Curve pool
	function _addLiquidity(uint256 _amount, address _vault) private returns (uint256 _lpTokenBal) {
		PoolInfo memory _poolInfo = poolInfos[_vault];
		_WETH.safeTransferFrom(address(_poolInfo.strategy), address(this), _amount);
		address _best = _findCurrentBest(_amount, _vault, address(0));
		address[] memory _path = new address[](2);
		_path[0] = address(_WETH);
		_path[1] = _best;
		uint256[] memory _amountsOut = _sushiRouter.swapExactTokensForTokens(_amount, 0, _path, address(this), block.timestamp);
		uint256[4] memory _amounts;
		_amounts[0] = _best == address(_poolInfo.baseToken) ? _amountsOut[1] : 0;
		_amounts[1] = _best == address(_DAI) ? _amountsOut[1] : 0;
		_amounts[2] = _best == address(_USDC) ? _amountsOut[1] : 0;
		_amounts[3] = _best == address(_USDT) ? _amountsOut[1] : 0;
		_lpTokenBal = _poolInfo.curveZap.add_liquidity(_amounts, 0);
	}

	function emergencyWithdraw(uint256 _amount, address _vault) external {
		require(msg.sender == address(poolInfos[_vault].strategy), "Not authorized strategy");
		uint256 _lpTokenBal = _addLiquidity(_amount, _vault);
		IERC20(IEarnVault(_vault).lpToken()).safeTransfer(_vault, _lpTokenBal);
	}

	function _findCurrentBest(uint256 _amount, address _vault, address _token) private returns (address) {
		IERC20 _baseToken = poolInfos[_vault].baseToken;

		address _best = address(_DAI);
		uint256 _amountOut = _token == address(0) ?
			_calcAmountOut(_amount, address(_DAI), _vault) : _calcAmountOut(_amount, _token, address(_DAI), _vault);
		uint256 _amountOutUSDC = _token == address(0) ?
			_calcAmountOut(_amount, address(_USDC), _vault) : _calcAmountOut(_amount, _token, address(_USDC), _vault);
		uint256 _amountOutUSDT = _token == address(0) ?
			_calcAmountOut(_amount, address(_USDT), _vault) : _calcAmountOut(_amount, _token, address(_USDT), _vault);
		uint256 _amountOutBase = _token == address(0) ?
			_calcAmountOut(_amount, address(_baseToken), _vault) : _calcAmountOut(_amount, _token, address(_baseToken), _vault);
		if (_amountOutUSDC > _amountOut) {
			_best = address(_USDC);
			_amountOut = _amountOutUSDC;
		}
		if (_amountOutUSDT > _amountOut) {
			_best = address(_USDT);
			_amountOut = _amountOutUSDT;
		}
		if (_amountOutBase > _amountOut) {
			_best = address(_baseToken);
		}
		return _best;
	}

	function _calcAmountOut(uint256 _amount, address _coin, address _vault) private returns (uint256) {
		address[] memory _path = new address[](2);
		_path[0] = address(_WETH);
		_path[1] = _coin;
		uint256[] memory _amountsOut = _sushiRouter.getAmountsOut(_amount, _path);

		PoolInfo memory _poolInfo = poolInfos[_vault];
		uint256[4] memory _amounts;
		_amounts[0] = _coin == address(_poolInfo.baseToken) ? _amountsOut[1] : 0;
		_amounts[1] = _coin == address(_DAI) ? _amountsOut[1] : 0;
		_amounts[2] = _coin == address(_USDC) ? _amountsOut[1] : 0;
		_amounts[3] = _coin == address(_USDT) ? _amountsOut[1] : 0;
		return _poolInfo.curveZap.calc_token_amount(_amounts, true);
	}

	function _calcAmountOut(uint256 _amount, address _token, address _coin, address _vault) private returns (uint256) {
		address[] memory _path = new address[](3);
		_path[0] = _token;
		_path[1] = address(_WETH);
		_path[2] = _coin;
		uint256[] memory _amountsOut = _sushiRouter.getAmountsOut(_amount, _path);

		PoolInfo memory _poolInfo = poolInfos[_vault];
		uint256[4] memory _amounts;
		_amounts[0] = _coin == address(_poolInfo.baseToken) ? _amountsOut[2] : 0;
		_amounts[1] = _coin == address(_DAI) ? _amountsOut[2] : 0;
		_amounts[2] = _coin == address(_USDC) ? _amountsOut[2] : 0;
		_amounts[3] = _coin == address(_USDT) ? _amountsOut[2] : 0;
		return _poolInfo.curveZap.calc_token_amount(_amounts, true);
	}

	function addPool(address vault_, address curvePool_, address curveZap_) external onlyOwner {
		IEarnVault _vault = IEarnVault(vault_);
		IERC20 _lpToken = IERC20(_vault.lpToken());
		ICurvePool _curvePool = ICurvePool(curvePool_);
		IERC20 _baseToken = IERC20(_curvePool.coins(0));
		address _strategy = _vault.strategy();

		_lpToken.safeApprove(vault_, type(uint).max);
		_lpToken.safeApprove(_strategy, type(uint).max);
		_lpToken.safeApprove(curveZap_, type(uint).max);
		_DAI.safeApprove(curveZap_, type(uint).max);
		_USDC.safeApprove(curveZap_, type(uint).max);
		_USDT.safeApprove(curveZap_, type(uint).max);
		_baseToken.safeApprove(curveZap_, type(uint).max);
		_baseToken.safeApprove(curvePool_, type(uint).max);
		_3Crv.safeApprove(curvePool_, type(uint).max);

		poolInfos[vault_] = PoolInfo(
            _curvePool,
            ICurveZap(curveZap_),
            IEarnStrategy(_strategy),
            _baseToken
        );
	}
    
	function setStrategy(address _strategy) external {
		require(address(poolInfos[msg.sender].strategy) != address(0), "Only authorized vault");
		poolInfos[msg.sender].strategy = IEarnStrategy(_strategy);
	}

	/// @notice Function to set new trusted forwarder address (Biconomy)
    /// @param _biconomy Address of new trusted forwarder
    function setBiconomy(address _biconomy) external onlyOwner {
        trustedForwarder = _biconomy;
        emit SetBiconomy(_biconomy);
    }

	function getVirtualPrice() external view returns (uint256) {
		return poolInfos[msg.sender].curvePool.get_virtual_price();
	}
}