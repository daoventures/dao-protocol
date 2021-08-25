pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./IUniswapV2Router02.sol";
import "./IUniswapV2Pair.sol";
import "./IMasterChef.sol";

// import "hardhat/console.sol";

interface Factory {
    function owner() external view returns (address);
}


contract DAOVaultOptionA is Initializable, ERC20Upgradeable, ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IUniswapV2Router02 public constant SushiRouter = IUniswapV2Router02(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);    
    IMasterChef public MasterChef;

    IERC20Upgradeable public lpToken; 
    IERC20Upgradeable public constant WETH = IERC20Upgradeable(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); 
    IERC20Upgradeable public constant SUSHI = IERC20Upgradeable(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2); 
    IERC20Upgradeable public constant WBTC = IERC20Upgradeable(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);
    IERC20Upgradeable public constant ibBTC = IERC20Upgradeable(0xc4E15973E6fF2A35cC804c2CF9D2a1b817a8b40F);
    IERC20Upgradeable public token0;
    IERC20Upgradeable public token1;
    IUniswapV2Pair public lpPair;
    Factory public factory;

    address public admin; 
    address public treasuryWallet;
    address public communityWallet;
    address public strategist;

    uint public poolId;
    uint[] public networkFeeTier2;
    uint public customNetworkFeeTier;
    uint[] public networkFeePerc;
    uint public customNetworkFeePerc;
    uint private _fees; // 18 decimals
    uint private masterChefVersion;
    uint public yieldFee;

    bool isEmergency;

    mapping(address => bool) public isWhitelisted;

    event Yield(uint _yieldAmount);
    event SetNetworkFeeTier2(uint256[] oldNetworkFeeTier2, uint256[] newNetworkFeeTier2);
    event SetNetworkFeePerc(uint256[] oldNetworkFeePerc, uint256[] newNetworkFeePerc);
    event SetCustomNetworkFeeTier(uint256 indexed oldCustomNetworkFeeTier, uint256 indexed newCustomNetworkFeeTier);
    event SetCustomNetworkFeePerc(uint256 oldCustomNetworkFeePerc, uint256 newCustomNetworkFeePerc);
    event SetTreasuryWallet(address indexed _treasuryWallet);
    event SetCommunityWallet(address indexed _communityWallet);
    event SetAdminWallet(address indexed _admin);
    event SetStrategistWallet(address indexed _strategistWallet);
    event Deposit(address indexed _token, address _from, uint _amount, uint _sharesMinted);
    event Withdraw(address indexed _token, address _from, uint _amount, uint _sharesBurned);

    uint256[49] private __gap;
    modifier onlyAdmin {
        require(msg.sender == admin, "Only Admin");
        _;
    }

    modifier onlyOwner {
        require(msg.sender == factory.owner(), "only Owner");
        _;
    }

    ///@dev For ETH-token pairs, _token0 should be ETH 
    function initialize(string memory _name, string memory _symbol, uint _poolId, 
      IERC20Upgradeable _token0, IERC20Upgradeable _token1, IERC20Upgradeable _lpToken,
      address _communityWallet, address _treasuryWallet, address _strategist, address _admin,
      address _masterchef, uint _masterChefVersion) external initializer {
        
        __ERC20_init(_name, _symbol);
        
        poolId = _poolId;
        yieldFee = 2000; //20%

        MasterChef  = IMasterChef(_masterchef); 
        masterChefVersion = _masterChefVersion;

        token0 = _token0;
        token1 = _token1;
        lpToken = _lpToken;
        lpPair = IUniswapV2Pair(address(_lpToken));
        communityWallet = _communityWallet;
        treasuryWallet = _treasuryWallet;
        strategist = _strategist;
        admin = _admin;

        factory = Factory(msg.sender);

        networkFeeTier2 = [50000*1e18+1, 100000*1e18];
        customNetworkFeeTier = 1000000*1e18;
        networkFeePerc = [100, 75, 50];
        customNetworkFeePerc = 25;

        token0.safeApprove(address(SushiRouter), type(uint).max);
        token1.safeApprove(address(SushiRouter), type(uint).max);
        lpToken.safeApprove(address(SushiRouter), type(uint).max);
        lpToken.safeApprove(address(MasterChef), type(uint).max);
        SUSHI.safeApprove(address(SushiRouter), type(uint).max);

    }
        
    /**
        @param _amount amount of token to deposit.
        @dev For ETH send, msg.value is used instead of _amount
     */
    function deposit(uint _amount) external nonReentrant {
        require(isEmergency == false ,"Deposit paused");
        require(_amount > 0, "Invalid amount");

        _deposit(_amount);
    }

    /** 
        @param _shares shares to withdraw.
     */
    function withdraw(uint _shares) external nonReentrant returns (uint amountToWithdraw){
        require(_shares > 0, "Invalid amount");
        
        amountToWithdraw = _withdraw(_shares);
    }

    function _withdraw(uint _shares) internal returns (uint amountToWithdraw){
        amountToWithdraw = balance().mul(_shares).div(totalSupply()); 

        uint lpInVault = available();
        
        if(amountToWithdraw > lpInVault) {
            _withdrawFromPool(amountToWithdraw.sub(lpInVault));
        }

        _burn(msg.sender, _shares);

        lpToken.safeTransfer(msg.sender, amountToWithdraw);

        emit Withdraw(address(lpToken), msg.sender, amountToWithdraw, _shares);//NEW_CHANGE //remove lptoken from event

    }

    function yield() external onlyAdmin{
        require(isEmergency == false ,"yield paused");
        _yield();

    }

    ///@dev Moves lpTokens from this contract to Masterchef
    function invest() external onlyAdmin {
        require(isEmergency == false ,"Invest paused");

        _transferFee();

        uint balanceInVault = available();
        if(balanceInVault > 0) {
            _stakeToPool(balanceInVault);
        }
    }

    function whitelistContract(address _addr, bool _status) external onlyOwner {
        isWhitelisted[_addr] = _status;
    }

    /**
     *@param _yieldFee yieldFee percentange. 2000 for 20%
     */
    function setYieldFee(uint _yieldFee) external onlyOwner {
        yieldFee = _yieldFee;
    }

    ///@dev Withdraws lpTokens from masterChef. Yield, invest functions will be paused
    function emergencyWithdraw() external onlyAdmin {    
        isEmergency = true;
        // _yield();

        (uint lpTokenBalance, ) = MasterChef.userInfo(poolId, address(this));
        _withdrawFromPool(lpTokenBalance);
    }

    ///@dev Moves funds in this contract to masterChef. ReEnables deposit, yield, invest.
    function reInvest() external onlyOwner {        

        _stakeToPool(available());

        isEmergency = false;
    }

    /// @notice Function to set new network fee for deposit amount tier 2
    /// @param _networkFeeTier2 Array that contains minimum and maximum amount of tier 2 (18 decimals)
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
    /// @param _customNetworkFeeTier Amount of new custom network fee tier (18 decimals)
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

    function setTreasuryWallet(address _treasuryWallet) external onlyAdmin {
        treasuryWallet = _treasuryWallet;
        emit SetTreasuryWallet(_treasuryWallet);
    }

    function setCommunityWallet(address _communityWallet) external onlyAdmin {
        communityWallet = _communityWallet;
        emit SetCommunityWallet(_communityWallet);
    }

    function setStrategistWallet(address _strategistWallet) external onlyAdmin {
        strategist = _strategistWallet;
        emit SetStrategistWallet(_strategistWallet);
    }

    ///@dev To move lpTokens from masterChef to this contract.
    function withdrawToVault(uint _amount) external onlyAdmin {
        _withdrawFromPool(_amount);
    }

    ///@dev swap to required lpToken. Deposit to masterChef in invest()
    function _deposit(uint _amount) internal returns(uint _lpTokens){

        if(isWhitelisted[msg.sender]) {
            _lpTokens = _amount;
        } else {
            uint256 _fee = _amount.div(10); //10%
            _fees = _fees.add(_fee);
            _lpTokens = _amount.sub(_fee);
        }

        uint shares;
        uint lpTokenPool = balance();

        lpToken.transferFrom(msg.sender, address(this), _amount);
        // console.log(lpToken.balanceOf(address(this)));

        if(totalSupply() == 0) {
            shares = _lpTokens;
        } else {
            shares = _lpTokens.mul(totalSupply()).div(lpTokenPool);
        }

        _mint(msg.sender, shares);

        emit Deposit(address(lpToken), msg.sender, _amount, shares);

    }

    function _withdrawFromPool(uint _amount) internal {
        if(masterChefVersion == 1 ) {
            MasterChef.withdraw(poolId, _amount);
        } else {
            MasterChef.withdraw(poolId, _amount, address(this));
        }
    }

    receive() external payable {
    }


    function _yield() internal {
        uint lpTokens;
        uint token1Reward;
        uint rewardInETH;
        address[] memory path = new address[](2);

        if(masterChefVersion == 1) {
            MasterChef.deposit(poolId, 0); // To collect SUSHI
        } else {
            MasterChef.harvest(poolId, address(this)); //claim sushi rewards
            token1Reward = token1.balanceOf(address(this));
            uint[] memory _tokensAmount = _swapTokenToPairs(address(token1),token1Reward);

            path[0] = address(token1);
            path[1] = address(WETH);
            
            rewardInETH = SushiRouter.getAmountsOut(token1Reward, path)[1];
            lpTokens = _addLiquidity(_tokensAmount[1], _tokensAmount[0]);
        }

        uint sushiBalance = SUSHI.balanceOf(address(this));
        
        if(sushiBalance > 0) {
            lpTokens = lpTokens.add(_swapSushi(sushiBalance.div(2)));
        }

        uint lpTokenBalance = available();
        if(lpTokens > 0) {
             uint fee = lpTokens.mul(yieldFee).div(10000);  //20%
            _fees = _fees.add(fee);
            _stakeToPool(lpTokenBalance.sub(fee));

            path[0] = address(SUSHI);
            path[1] = address(WETH);

            rewardInETH = rewardInETH.add(SushiRouter.getAmountsOut(sushiBalance, path)[1]);
        }

        emit Yield(rewardInETH);

    }

    function _swapSushi(uint _amount) internal returns (uint _lptokens){
        address[] memory path = getPathSushi(address(token0));

            _swapExactTokens(_amount, 0, path);

            path = getPathSushi(address(token1));

            _swapExactTokens(_amount, 0, path);   
            _lptokens = _addLiquidity (token0.balanceOf(address(this)), token1.balanceOf(address(this)));     
    }

    function getPathSushi(address _targetToken) internal view returns (address[] memory path) {
        if(token0 == WBTC) {
            if(address(token0) == _targetToken) {
                path = new address[](3);
                path[0] = address(SUSHI);
                path[1] = address(WETH);
                path[2] = _targetToken;
            } else {
                path = new address[](4);
                path[0] = address(SUSHI);
                path[1] = address(WETH);
                path[2] = address(WBTC);
                path[3] = _targetToken;
            }
        } else {
            path = new address[](2);
            path[0] = address(SUSHI);
            path[1] = _targetToken;
        }


    }

    ///@dev Converts ETH to WETH and swaps to required pair token
    function _swapETHToPairs() internal returns (uint[] memory _tokensAmount){
        
        (bool _status,) = payable(address(WETH)).call{value: msg.value}(""); //wrap ETH to WETH
        require(_status, 'ETH-WETH failed');
        
        address[] memory path = new address[](2);
        path[0] = address(WETH);
        path[1] = address(token1);
        
        
        _tokensAmount = _swapExactTokens(msg.value.div(2), 0, path);

    }

    ///@dev swap to required pair tokens
    function _swapTokenToPairs(address _token, uint _amount) internal returns (uint[] memory _tokensAmount) {
        
        address[] memory path = new address[](2);
        path[0] = _token;
        path[1] = _token == address(token0) ? address(token1) : address(token0);
        
        uint[] memory _tokensAmountTemp = _swapExactTokens(_amount.div(2), 0, path);

        if(_token == address(token0)){
            _tokensAmount = _tokensAmountTemp;
        } else {
            _tokensAmount = new uint[](2);
            _tokensAmount[0] = _tokensAmountTemp[1];
            _tokensAmount[1] = _tokensAmountTemp[0];
        }

    }

    function _addLiquidity(uint _amount0, uint _amount1) internal returns (uint lpTokens) {
        (,,lpTokens) = SushiRouter.addLiquidity(address(token0), address(token1), _amount0, _amount1, 0, 0, address(this), block.timestamp);
    }

    function _stakeToPool(uint _amount) internal {
        if(masterChefVersion == 1) {
            MasterChef.deposit(poolId, _amount);
        } else {
            MasterChef.deposit(poolId, _amount, address(this));
        }
    }

    ///@dev Transfer fee from vault
    function _transferFee() internal {
        uint feeSplit = _fees.mul(2).div(5);

        lpToken.safeTransfer(treasuryWallet, feeSplit); //40%
        lpToken.safeTransfer(communityWallet, feeSplit); //40
        lpToken.safeTransfer(strategist, _fees.sub(feeSplit).sub(feeSplit)); //20%

        _fees = 0;
    }

    function _swapExactTokens(uint _inAmount, uint _outAmount, address[] memory _path) internal returns (uint[] memory _tokens) {
        _tokens = SushiRouter.swapExactTokensForTokens(_inAmount, _outAmount, _path, address(this), block.timestamp);
    }

    ///@dev calculates the assets that will be removed for the give lpTokenAmount
    function getRemovedAmount(uint _inputAmount) internal view returns (uint _amount0, uint _amount1){
        uint totalSupply = lpPair.totalSupply();
        uint balance0 = token0.balanceOf(address(lpPair));
        uint balance1 = token1.balanceOf(address(lpPair));

        _amount0 = _inputAmount.mul(balance0) / totalSupply; //not using div() as per univ2
        _amount1 = _inputAmount.mul(balance1) / totalSupply; //not using div() as per univ2
    }
    ///@dev balance of LPTokens in vault + masterCHef
    function balance() public view returns (uint _balance){
        (uint balanceInMasterChef, ) = MasterChef.userInfo(poolId,address(this));
        _balance = available().add(balanceInMasterChef);
    }

    function available() public view returns (uint _available) {
        // console.log(address(lpToken));
        // console.log(lpToken.balanceOf(address(this)), _fees);
        _available = lpToken.balanceOf(address(this)).sub(_fees);
    }

    function getAllPoolInETH() external view returns (uint) {
        return 0;
    }

}


