pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "../../../libs/BaseRelayRecipient.sol";
import "../../../interfaces/IRelayRecipient.sol";
import "../../../interfaces/IUniswapV2Router02.sol";
import "../../../interfaces/IUniswapV2Pair.sol";
import "../../../interfaces/IMasterChef.sol";

contract DAOVaultETHUSDC is ERC20Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, BaseRelayRecipient{
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IUniswapV2Router02 public SushiRouter;    ////can be constant
    IMasterChef public MasterChef; //can be constant

    IERC20Upgradeable public lpToken; 
    IERC20Upgradeable public WETH; //can be constant
    IERC20Upgradeable public SUSHI; //can be constant
    IERC20Upgradeable public token0;
    IERC20Upgradeable public token1;

    address public admin; 

    uint public poolId;
    uint public amountToKeepInVault; //500 //5 %
    uint[] public networkFeeTier2;
    uint public customNetworkFeeTier;
    uint[] public networkFeePerc;
    uint public customNetworkFeePerc;
    uint private _fees; // 18 decimals

    bool isEmergency;

    mapping(address => uint) public depositedAmount;

    modifier onlyAdmin {
        require(msg.sender == admin, "Only Admin");
        _;
    }

    function initialize(string memory _name, string memory _symbol, uint _poolId, uint _amountToKeepInVault,
      IERC20Upgradeable _token0, IERC20Upgradeable _token1, IERC20Upgradeable _lpToken) external initializer {
        
        __ERC20_init(_name, _symbol);
        
        poolId = _poolId;
        amountToKeepInVault =_amountToKeepInVault;

        token0 = _token0;
        token1 = _token1;
        lpToken = _lpToken;

        networkFeeTier2 = [50000*1e18+1, 100000*1e18];
        customNetworkFeeTier = 1000000*1e18;
        networkFeePerc = [100, 75, 50];
        customNetworkFeePerc = 25;

        token0.safeApprove(address(SushiRouter), type(uint).max);
        token1.safeApprove(address(SushiRouter), type(uint).max);
        lpToken.safeApprove(address(SushiRouter), type(uint).max);
        lpToken.safeApprove(address(MasterChef), type(uint).max);

    }

    /// @notice Function that required for inherict BaseRelayRecipient
    function _msgSender() internal override(ContextUpgradeable, BaseRelayRecipient) view returns (address payable) {
        return BaseRelayRecipient._msgSender();
    }
    
    /// @notice Function that required for inherict BaseRelayRecipient
    function versionRecipient() external pure override returns (string memory) {
        return "1";
    }

    function deposit(IERC20Upgradeable _token, uint _amount) external payable {
        require(tx.origin == msg.sender || isTrustedForwarder(msg.sender), "only EOA");
        require(isEmergency == false ,"Deposit paused");
        //TODO - add nonReentrant
        //share calculations
        require(_token == token0 || _token == token1 || address(_token) == address(0), "Invalid Token"); //address(0) - ETH (not WETH)

        if(address(_token) == address(0)) {
            require(msg.value > 0, "Invalid ETH sent");
        } else {
            require(_amount > 0, "Invalid token amount");
            _token.safeTransferFrom(msg.sender, address(this), _amount);
        }

        uint shares;
        uint lpTokenPool = balance();
        uint lpTokensSupplied = _deposit(address(_token), _amount); //TODO use better name for _deposit()

        if(totalSupply() == 0) {
            shares = lpTokensSupplied;
        } else {
            shares = lpTokensSupplied.mul(totalSupply()).div(lpTokenPool);
        }

        _mint(msg.sender, shares);

        
    }

    function withdraw(IERC20Upgradeable _token, uint _shares) external { //TODO add nonreEntrant
        require(msg.sender == tx.origin, "Only EOA");
        require(_token == token0 || _token == token1 || address(_token) == address(0), "Invalid Token"); //address(0) - withdraw in ETH (not WETH)
        
        uint amountToWithdraw;
        uint lpTokenInPool = balance();
        uint amountOfLpsToWithdraw = lpTokenInPool.mul(_shares).div(totalSupply()); 

        uint lpInVault = available();

        if(amountOfLpsToWithdraw > lpInVault) {
            _withdrawFromPool(amountOfLpsToWithdraw.sub(lpInVault));
        }

        amountToWithdraw = amountOfLpsToWithdraw; // when lpToken is withdrawn by user

        if(_token != lpToken) {
            address[] memory path = new address[](2);

            if(address(_token) == address(0)) {
                //user withdraws in ETH

                (uint _token1Removed, )= SushiRouter.removeLiquidityETH(address(token1), amountOfLpsToWithdraw, 0, 0, address(this), block.timestamp);

                path[0] = address(token1);
                path[1] = address(WETH);
                SushiRouter.swapExactTokensForETH(_token1Removed, 0, path, address(this), block.timestamp);

                amountToWithdraw = address(this).balance;

            } else {
                //user withdraws in one of underlying token
                (uint _amount0, uint _amount1) = SushiRouter.removeLiquidity(address(token0), address(token1), amountOfLpsToWithdraw, 0, 0, address(this), block.timestamp);    
                
                path[0] = _token == token0 ? address(token1) : address(token0); //other token frm withdrawn token
                path[1] = address(_token); //withdrawn token

                SushiRouter.swapExactTokensForTokens(_token == token0 ? _amount1 : _amount0, 0, path, address(this), block.timestamp);        
                
                amountToWithdraw = _token.balanceOf(address(this));
            }
        }

        _burn(msg.sender, _shares);

        _withdrawToUser(msg.sender, amountToWithdraw, _token);

        //transfer to user
    }

    function yield() external onlyAdmin{
        require(isEmergency == false ,"yield paused");
        _yield();

    }

    function invest() external onlyAdmin {
        require(isEmergency == false ,"Invest paused");
        //keep some % of lpTokens in vault, deposit remaining to masterChef 
        //TODO withdraw fee and set _fees = 0
        uint lpTokenBalance = available();

        uint amountToDeposit = lpTokenBalance.mul(amountToKeepInVault).div(10000);

        _stakeToPool(amountToDeposit);
    }

    function emergencyWithdraw() external onlyAdmin {    
        isEmergency = true;
        _yield();

        (uint lpTokenBalance, ) = MasterChef.userInfo(poolId, address(this));
        MasterChef.withdraw(poolId, lpTokenBalance);
    }

    function reInvest() external onlyOwner {        
        uint lpTokenBalance = available();

        uint amountToDeposit = lpTokenBalance.mul(amountToKeepInVault).div(10000);

        _stakeToPool(amountToDeposit);

        isEmergency = false;
    }

    function setBiconomy(address _biconomy) external onlyOwner {
        trustedForwarder = _biconomy;
    }

    ///@dev swap to required lpToken. Deposit to masterChef in invest()
    function _deposit(address _token, uint _amount) internal returns(uint _lpTokens){
        
        //_token is not lpToken, so conver token to required pairs
        if(_token != address(lpToken)) {
            //address of _token is address(0) when ETH is used(not WETH) 
            uint[] memory _tokensAmount = _token == address(0) ? _swapETHToPairs() : _swapTokenToPairs(_token, _amount);

            //add liquidity to sushiSwap
            _lpTokens = _addLiquidity(_tokensAmount[0], _tokensAmount[1]);
        }  else {
            _lpTokens = _amount;
        }

        uint256 _networkFeePerc;
        if (_lpTokens < networkFeeTier2[0]) {
            // Tier 1
            _networkFeePerc = networkFeePerc[0];
        } else if (_lpTokens <= networkFeeTier2[1]) {
            // Tier 2
            _networkFeePerc = networkFeePerc[1];
        } else if (_lpTokens < customNetworkFeeTier) {
            // Tier 3
            _networkFeePerc = networkFeePerc[2];
        } else {
            // Custom Tier
            _networkFeePerc = customNetworkFeePerc;
        }

        uint256 _fee = _lpTokens.mul(_networkFeePerc).div(10000);
        _fees = _fees.add(_fee);
        _lpTokens = _lpTokens.sub(_fee);
    }

    function _withdrawFromPool(uint _amount) internal {
        MasterChef.withdraw(poolId, _amount);
    }

    function _withdrawToUser(address payable _user, uint _amount, IERC20Upgradeable _token) internal {
        if(address(_token) == address(0)) {
            (bool success, ) = _user.call{value: _amount}(""); //add gas
            require(success, "Transfer failed");
        } else {
            _token.safeTransfer(_user, _amount);
        }
    }

    function _yield() internal {
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

            uint fee = _lpTokens.div(20); //TODO check Percentage
            _fees = _fees.add(fee);

            _stakeToPool(_lpTokens.sub(fee));
        }
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
    function balance() public view returns (uint _balance){
        (uint balanceInMasterChef, ) = MasterChef.userInfo(poolId,address(this));
        _balance = available().add(balanceInMasterChef);
    }

    function available() public view returns (uint _available) {
        _available = lpToken.balanceOf(address(this)).sub(_fees);
    }

}

//TODO
//1. add biconomy
//3. owner functions
//2. admin or owner to move funds from masterChef to vault