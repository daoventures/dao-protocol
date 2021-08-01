// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../libs/BaseRelayRecipient.sol";

interface ICurvePool {
    function add_liquidity(uint256[2] memory _amounts, uint256 _amountOutMin) external;
    function remove_liquidity_one_coin(uint256 _amount, int128 _index, uint256 _amountOutMin) external;
    function get_virtual_price() external view returns (uint256);
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

contract CurveHBTCZap is Ownable, BaseRelayRecipient {
    using SafeERC20 for IERC20;

    ISushiRouter private constant _sushiRouter = ISushiRouter(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    ICurvePool public curvePool;
    IEarnStrategy public strategy;

    IERC20 private constant _WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 private constant _HBTC = IERC20(0x0316EB71485b0Ab14103307bf65a021042c6d380);
    IERC20 private constant _WBTC = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);

    event Deposit(address indexed vault, uint256 amount, address indexed coin, uint256 lptokenBal, uint256 daoERNBal, bool stake);
    event Withdraw(address indexed vault, uint256 shares, address indexed coin, uint256 lptokenBal, uint256 coinAmount);
    event SwapFees(uint256 amount, uint256 coinAmount, address indexed coin);
    event Compound(uint256 amount, address indexed vault, uint256 lpTokenBal);
    event AddLiquidity(uint256 amount, address indexed vault, address indexed best, uint256 lpTokenBal);
    event EmergencyWithdraw(uint256 amount, address indexed vault, uint256 lpTokenBal);
    event AddPool(address indexed vault, address indexed curvePool);
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
    /// @return Amount of minted shares from vault contract
    function depositZap(address _vault, uint256 _amount, address _tokenAddr, bool _stake) external payable onlyEOAOrBiconomy returns (uint256) {
        require(_amount > 0, "Amount must > 0");
        address _WBTCAddr = address(_WBTC);
        uint256 _daoERNBal;
        if (_tokenAddr == address(0)) { // Deposit ETH
            address[] memory _path = new address[](2);
            _path[0] = address(_WETH);
            _path[1] = _WBTCAddr;
            uint256[] memory _amounts = _sushiRouter.swapExactETHForTokens{value: msg.value}(0, _path, address(this), block.timestamp);
            _daoERNBal = _deposit(_vault, _amounts[1], _WBTCAddr, _stake);
        } else {
            IERC20 _token = IERC20(_tokenAddr);
            _token.safeTransferFrom(_msgSender(), address(this), _amount);
            if (_token.allowance(address(this), address(_sushiRouter)) == 0) {
                _token.safeApprove(address(_sushiRouter), type(uint256).max);
            }
            address[] memory _path = new address[](3);
            _path[0] = _tokenAddr;
            _path[1] = address(_WETH);
            _path[2] = _WBTCAddr;
            uint256[] memory _amounts = _sushiRouter.swapExactTokensForTokens(_amount, 0, _path, address(this), block.timestamp);
            _daoERNBal = _deposit(_vault, _amounts[2], _WBTCAddr, _stake);
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
        uint256[2] memory _amounts;
        if (_coin == address(_WBTC)) {
            _amounts[1] = _amount;
        } else if (_coin == address(_HBTC)) {
            _amounts[0] = _amount;
        } else {
            revert("Coin not acceptable");
        }
        curvePool.add_liquidity(_amounts, 0);
        uint256 _lpTokenBal = IERC20(IEarnVault(_vault).lpToken()).balanceOf(address(this));
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
        uint256 _lpTokenBal = IEarnVault(_vault).withdrawZap(_shares, msg.sender);
        int128 _index;
        if (_coin == address(_WBTC)) {
            _index = 1;
        } else if (_coin == address(_HBTC)) {
            _index = 0;
        } else {
            revert("Coin not acceptable");
        }
        curvePool.remove_liquidity_one_coin(_lpTokenBal, _index, 0);
        _coinAmount = IERC20(_coin).balanceOf(address(this));
        IERC20(_coin).safeTransfer(msg.sender, _coinAmount);
        emit Withdraw(_vault, _shares, _coin, _lpTokenBal, _coinAmount);
    }

    /// @notice Function to swap fees from vault contract (and transfer back to vault contract)
    /// @param _amount Amount of LP token to be swapped (18 decimals)
    /// @return Amount and address of coin to receive (amount follow decimal of coin)
    function swapFees(uint256 _amount) external returns (uint256, address) {
        require(address(curvePool) != address(0), "Only authorized vault");
        IERC20(IEarnVault(msg.sender).lpToken()).safeTransferFrom(msg.sender, address(this), _amount);
        curvePool.remove_liquidity_one_coin(_amount, 1, 0);
        uint256 _coinAmount = _WBTC.balanceOf(address(this));
        _WBTC.safeTransfer(msg.sender, _coinAmount);
        emit SwapFees(_amount, _coinAmount, address(_WBTC));
        return (_coinAmount, address(_WBTC));
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
        address[] memory _path = new address[](2);
        _path[0] = address(_WETH);
        _path[1] = address(_WBTC);
        uint256[] memory _amountsOut = _sushiRouter.swapExactTokensForTokens(_amount, 0, _path, address(this), block.timestamp);
        uint256[2] memory _amounts = [0, _amountsOut[1]];
        curvePool.add_liquidity(_amounts, 0);
        _lpTokenBal = IERC20(IEarnVault(_vault).lpToken()).balanceOf(address(this));
        emit AddLiquidity(_amount, _vault, address(_WBTC), _lpTokenBal);
    }

    /// @notice Same function as compound() but transfer received LP token to vault instead of strategy contract
    /// @param _amount Amount to emergency withdraw in WETH
    /// @param _vault Address of vault contract
    function emergencyWithdraw(uint256 _amount, address _vault) external {
        require(msg.sender == address(strategy), "Only authorized strategy");
        uint256 _lpTokenBal = _addLiquidity(_amount, _vault);
        IERC20(IEarnVault(_vault).lpToken()).safeTransfer(_vault, _lpTokenBal);
        emit EmergencyWithdraw(_amount, _vault, _lpTokenBal);
    }

    /// @notice Function to add new Curve pool (limit to Curve HBTC pool only)
    /// @param vault_ Address of corresponding vault contract
    /// @param curvePool_ Address of Curve metapool contract
    function addPool(address vault_, address curvePool_) external onlyOwner {
        IEarnVault _vault = IEarnVault(vault_);
        IERC20 _lpToken = IERC20(_vault.lpToken());
        strategy = IEarnStrategy(_vault.strategy());
        curvePool = ICurvePool(curvePool_);

        _lpToken.safeApprove(vault_, type(uint).max);
        _lpToken.safeApprove(address(strategy), type(uint).max);
        _HBTC.safeApprove(curvePool_, type(uint).max);
        _WBTC.safeApprove(curvePool_, type(uint).max);

        emit AddPool(vault_, curvePool_);
    }

    /// @notice Function to set new strategy contract
    /// @param _strategy Address of new strategy contract
    function setStrategy(address _strategy) external {
        require(address(strategy) != address(0), "Only authorized vault");
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

    /// @notice Function to check token availability to depositZap(). _tokenOut = WBTC
    /// @param _amount Amount to be swapped (decimals follow _tokenIn)
    /// @param _tokenIn Address to be swapped
    /// @return Amount out in BTC. Token not available if return 0.
    function checkTokenSwapAvailability(uint256 _amount, address _tokenIn) external view returns (uint256) {
        address[] memory _path = new address[](3);
        _path[0] = _tokenIn;
        _path[1] = address(_WETH);
        _path[2] = address(_WBTC);
        try _sushiRouter.getAmountsOut(_amount, _path) returns (uint256[] memory _amountsOut){
            return _amountsOut[2];
        } catch {
            return 0;
        }
    }
}