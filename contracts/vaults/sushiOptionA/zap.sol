pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";

import "../../../libs/BaseRelayRecipient.sol";
import "../../../interfaces/IRelayRecipient.sol";
import "../../../interfaces/IUniswapV2Router02.sol";

interface Vault {
    function depositUnderlying(uint _amount, address _user) external;
    function withdrawUnderlying(uint _shares, address _user) external returns (uint);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function lpToken() external view returns (IERC20Upgradeable);
    function deposit(uint _amount) external;
    function withdraw(uint _shares) external returns (uint);
}

contract zapOptionA is BaseRelayRecipient{
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IUniswapV2Router02 public constant SushiRouter = IUniswapV2Router02(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);  
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    modifier onlyOwner {
        address _owner;

        //read owner from proxy's storage slot
        assembly {
            _owner := sload(0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103) //bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1)
        }

        require(msg.sender == _owner, "Only Owner");
        _;
    }
    
    /// @notice Function that required for inherict BaseRelayRecipient
    function versionRecipient() external pure override returns (string memory) {
        return "1";
    }

    function setBiconomy(address _biconomy) external onlyOwner {
        trustedForwarder = _biconomy;
    }

    function deposit(Vault _vault, uint _amount) external {
        require(msg.sender == tx.origin || isTrustedForwarder(msg.sender), "Only EOA");
        require(_amount >0, "Invalid amount");

        address _sender = _msgSender();

        _vault.lpToken().safeTransferFrom(_sender, address(this), _amount);

        _vault.deposit(_amount);
    }

    function depositUnderlying(Vault _vault, address _token, uint _amount) external payable{
        require(msg.sender == tx.origin || isTrustedForwarder(msg.sender), "Only EOA");

        address _sender = _msgSender();

        if(_token == address(0)) {
            require(msg.value > 0, "Invalid ETH amount");
        } else {
            require(_amount > 0, "Invalid amount");
            IERC20Upgradeable(_token).safeTransferFrom(_sender, address(this), _amount);
        }

        address _token0 = _vault.token0();
        address _token1 = _vault.token1();

        uint[] memory _tokensAmount = _token == address(0) ? _swapTokenToPairs(_token, _amount, _token0, _token1) : 
            _swapTokenToPairs(_token, _amount, _token0, _token1);

        uint lpTokens = _addLiquidity(_tokensAmount[0], _tokensAmount[1], _token0, _token1);

        _vault.depositUnderlying(lpTokens, _sender);
    }

    function withdraw(Vault _vault, uint _shares) external {
        require(msg.sender == tx.origin || isTrustedForwarder(msg.sender), "Only EOA");
        require(_shares > 0, "Invalid amount");

        uint _lpTokens = _vault.withdraw(_shares);        
        _vault.lpToken().safeTransfer(msg.sender, _lpTokens);
    }

    function withdrawUnderlying(Vault _vault, address _token, uint _shares) external {
        require(msg.sender == tx.origin, "Only EOA");
        require(_shares >0, "Invalid amount");

        address _token0 = _vault.token0();
        address _token1 = _vault.token1();

        if(_token0 == WETH) {
            require(_token == _token0 || _token == _token1 || _token == address(0), "Invalid out token");
        } else {
            require(_token == _token0 || _token == _token1, "Invalid out token");
        }

        uint _lpTokens =_vault.withdrawUnderlying(_shares, msg.sender);

        _removeLiquidityAndWithdraw(_lpTokens, _token0, _token1, _token);
    }

    function approve(IERC20Upgradeable _token0, IERC20Upgradeable _token1, IERC20Upgradeable _lpToken, address _vault) external onlyOwner {
        _token0.safeApprove(address(SushiRouter), type(uint).max);
        _token1.safeApprove(address(SushiRouter), type(uint).max);
        _lpToken.safeApprove(address(SushiRouter), type(uint).max);

        _token0.safeApprove(address(_vault), type(uint).max);
        _token1.safeApprove(address(_vault), type(uint).max);
        _lpToken.safeApprove(address(_vault), type(uint).max);
    }

     ///@dev Converts ETH to WETH and swaps to required pair token
    function _swapETHToPairs(address _token1) internal returns (uint[] memory _tokensAmount){
        
        (bool _status,) = payable(WETH).call{value: msg.value}(""); //wrap ETH to WETH
        require(_status, 'ETH-WETH failed');
        
        address[] memory path = new address[](2);
        path[0] = address(WETH);
        path[1] = address(_token1);
        
        
        _tokensAmount = _swapExactTokens(msg.value.div(2), 0, path);

    }

    ///@dev swap to required pair tokens
    function _swapTokenToPairs(address _token, uint _amount, address _token0, address _token1) internal returns (uint[] memory _tokensAmount) {
        
        address[] memory path = new address[](2);
        path[0] = _token;
        path[1] = _token == address(_token0) ? address(_token1) : address(_token0);
        
        uint[] memory _tokensAmountTemp = _swapExactTokens(_amount.div(2), 0, path);

        if(_token == address(_token0)){
            _tokensAmount = _tokensAmountTemp;
        } else {
            _tokensAmount = new uint[](2);
            _tokensAmount[0] = _tokensAmountTemp[1];
            _tokensAmount[1] = _tokensAmountTemp[0];
        }

    }

    function _swapExactTokens(uint _inAmount, uint _outAmount, address[] memory _path) internal returns (uint[] memory _tokens) {
        _tokens = SushiRouter.swapExactTokensForTokens(_inAmount, _outAmount, _path, address(this), block.timestamp);
    }

    function _addLiquidity(uint _amount0, uint _amount1, address _token0, address _token1) internal returns (uint lpTokens) {
        (,,lpTokens) = SushiRouter.addLiquidity(_token0, _token1, _amount0, _amount1, 0, 0, address(this), block.timestamp);
    }

    function _removeLiquidityAndWithdraw(uint lpTokenAmount, address _token0, address _token1, address _targetToken) internal  {
        address[] memory path = new address[](2);

        if(_targetToken == address(0)) {
            SushiRouter.removeLiquidityETH(_token1, lpTokenAmount, 0, 0, address(this), block.timestamp);
            
            path[0] = _token1;
            path[1] = WETH;
            
            SushiRouter.swapExactTokensForETH(IERC20Upgradeable(_token1).balanceOf(address(this)), 0, path, address(this), block.timestamp);

            (bool _status, ) = msg.sender.call{value: address(this).balance}("");

            require(_status, "ETH Transfer failed");

        } else {
            IERC20Upgradeable _target = IERC20Upgradeable(_targetToken);

            SushiRouter.removeLiquidity(_token0, _token1, lpTokenAmount, 0, 0, address(this), block.timestamp);

            path[0] = _targetToken == _token0 ? _token1 : _token0;
            path[1] = _targetToken;

            SushiRouter.swapExactTokensForTokens(IERC20Upgradeable(path[0]).balanceOf(address(this)), 0, path, address(this), block.timestamp);

            _target.safeTransfer(msg.sender, _target.balanceOf(address(this)));
        }
        
    }

}