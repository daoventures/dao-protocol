pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../../../interfaces/IUniswapV2Router02.sol";
import "../../../interfaces/IUniswapV2Pair.sol";
import "../../../interfaces/IMasterChef.sol";

contract DAOVaultETHUSDC is ERC20Upgradeable {
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IUniswapV2Router02 public SushiRouter;    ////can be constant
    IMasterChef public MasterChef; //can be constant

    IERC20Upgradeable public lpToken; ////can be constant
    IERC20Upgradeable public WETH; //can be constant
    IERC20Upgradeable public SUSHI; //can be constant
    IERC20Upgradeable public token0;
    IERC20Upgradeable public token1;

    address public admin; 

    uint public poolId;
    uint public amountToKeepInVault; //500 //5 %

    modifier onlyAdmin {
        require(msg.sender == admin, "Only Admin");
        _;
    }

    function initialize(string memory _name, string memory _symbol, uint _poolId, uint _amountToKeepInVault) external initializer {
        __ERC20_init(_name, _symbol);
        poolId = _poolId;
        amountToKeepInVault =_amountToKeepInVault;
    }

    function deposit(IERC20Upgradeable _token, uint _amount) external payable {
        //TODO - add nonReentrant
        //share calculations
        require(_token == token0 || _token == token1 || address(_token) == address(0), "Invalid Token"); //address(0) - ETH (not WETH)

        if(address(_token) == address(0)) {
            require(msg.value > 0, "Invalid ETH sent");
        } else {
            require(_amount > 0, "Invalid token amount");
            _token.safeTransferFrom(msg.sender, address(this), _amount);
        }

        _deposit(address(_token), _amount);
    }

    function withdraw(IERC20Upgradeable _token, uint _amount) external { //TODO add nonreEntrant
        require(msg.sender == tx.origin, "Only EOA");
        require(_token == token0 || _token == token1 || address(_token) == address(0), "Invalid Token"); //address(0) - withdraw in ETH (not WETH)

        uint amountToWithdraw; //share calculations

        uint lpInVault = lpToken.balanceOf(address(this));

        if(amountToWithdraw > lpInVault) {
            uint diff = amountToWithdraw.sub(lpInVault);
            _withdrawFromPool(diff);
        }

        if(_token != lpToken) {
            //TODO CHECK - amountTOWithdraw // 

            // uint withdrawnAmount
            if(address(_token) == address(0)) {
                SushiRouter.removeLiquidity(address(token0), address(token1), amountToWithdraw, 0, 0, address(this), block.timestamp);
            } else {
                SushiRouter.removeLiquidityETH(address(token1), amountToWithdraw, 0, 0, address(this), block.timestamp);                
            }
            
        }

        //transfer to user
    }

    function yield() external onlyAdmin{
        //check sushi balance
        //swap to token0 and token1
        //addLiquidity
        //_stakeToPool

        uint sushiBalance = SUSHI.balanceOf(address(this));
        if(sushiBalance > 0) {
            address[] memory path = new address[](2);
            path[0] = address(SUSHI);
            path[1] = address(token0);

            uint sushiToSwap = sushiBalance.div(2);

            uint[] memory amountsToken0 = SushiRouter.swapExactTokensForTokens(sushiToSwap, 0, path, address(this), block.timestamp);

            path[1] = address(token1);

            uint[] memory amountsToken1 = SushiRouter.swapExactTokensForTokens(sushiToSwap, 0, path, address(this), block.timestamp);

            uint _lpTokens = _addLiquidity(amountsToken0[1], amountsToken1[1]);

            _stakeToPool(_lpTokens);
        }

    }

    function invest() external onlyAdmin {
        //keep some % of lpTokens in vault, deposit remaining to masterChef 
        uint lpTokenBalance = lpToken.balanceOf(address(this));

        uint amountToDeposit = lpTokenBalance.mul(amountToKeepInVault).div(10000);

        _stakeToPool(amountToDeposit);
    }

    ///@dev swap to required lpToken. Deposit to masterChef in invest()
    function _deposit(address _token, uint _amount) internal {
        
        //_token is not lpToken, so conver token to required pairs
        if(address(_token) != address(lpToken)) {
            //address of _token is address(0) when ETH is used(not WETH) 
            uint[] memory _tokensAmount = _token == address(0) ? _swapETHToPairs() : _swapTokenToPairs(_token, _amount);

            //add liquidity t sushiSwap
            //uint _lpTokenAmount = 
            _addLiquidity(_tokensAmount[0], _tokensAmount[1]);

            //stake to masterChef
            // stakeToPool(_lpTokenAmount);
        }
    }

    function _withdrawFromPool(uint _amount) internal {
        MasterChef.withdraw(poolId, _amount);
    }

    function _swapETHToPairs() internal returns (uint[] memory _tokensAmount){
        address[] memory path = new address[](2);
        path[0] = address(WETH);
        path[1] = address(token0) == address(WETH) ? address(token1) : address(token0);
        
        _tokensAmount = SushiRouter.swapExactETHForTokens{value: msg.value.div(2)}(0, path, address(this), block.timestamp);

    }

    function _swapTokenToPairs(address _token, uint _amount) internal returns (uint[] memory _tokensAmount) {
        
        address[] memory path = new address[](2);
        path[0] = _token;
        path[1] = _token == address(token0) ? address(token1) : address(token0);

        _tokensAmount = SushiRouter.swapExactTokensForTokens(_amount.div(2), 0, path, address(this), block.timestamp);
    }

    function _addLiquidity(uint _amount0, uint _amount1) internal returns (uint lpTokens) {
        (,,lpTokens) = SushiRouter.addLiquidity(address(token0), address(token1), _amount0, _amount1, 0, 0, address(this), block.timestamp);
    }

    function _stakeToPool(uint _amount) internal {
        MasterChef.deposit(poolId, _amount);
    }

    ///@dev balance of LPTokens in vault + masterCHef
    function balance() public view {}

    ///@dev balance of LPTokens in vault
    function available() public view {}
}

//TODO
//1. update deposit() and withdraw()
//2. emergencyWithdraw()
//3. owner functions
//4. share calculation and feeSplit