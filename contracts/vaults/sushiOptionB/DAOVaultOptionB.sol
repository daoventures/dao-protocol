pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

import "../../../libs/BaseRelayRecipient.sol";
import "../../../interfaces/IRelayRecipient.sol";
import "../../../interfaces/IUniswapV2Router02.sol";
import "../../../interfaces/IUniswapV2Pair.sol";
import "../../../interfaces/IMasterChef.sol";
import "../../../interfaces/IUniswapV2Pair.sol";
import "../../../interfaces/IxSUSHI.sol";
import "../../../interfaces/IKashiPair.sol";

interface Factory {
    function owner() external view returns (address);
}


contract DAOVaultOptionB is Initializable, ERC20Upgradeable, BaseRelayRecipient{
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IUniswapV2Router02 public constant SushiRouter = IUniswapV2Router02(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);    
    IMasterChef public constant MasterChef = IMasterChef(0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd); 

    IERC20Upgradeable public lpToken; 
    IERC20Upgradeable public constant WETH = IERC20Upgradeable(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); 
    IERC20Upgradeable public constant SUSHI = IERC20Upgradeable(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2); 
    IERC20Upgradeable public token0;
    IERC20Upgradeable public token1;
    IUniswapV2Pair public lpPair;
    Factory public factory;
    IxSUSHI public constant xSUSHI = IxSUSHI(0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272);
    IKashiPair public KashiPair;

    address public admin; 
    address public treasuryWallet;
    address public communityWallet;
    address public strategist;
    address private bentoBox;

    uint public poolId;
    uint public amountToKeepInVault; //500 //5 %
    uint[] public networkFeeTier2;
    uint public customNetworkFeeTier;
    uint[] public networkFeePerc;
    uint public customNetworkFeePerc;
    uint private fractions;
    uint private _fees; // 18 decimals

    bool isEmergency;

    mapping(address => uint) public depositedAmount;

    event Yield(uint _yieldAmount);
    event SetNetworkFeeTier2(uint256[] oldNetworkFeeTier2, uint256[] newNetworkFeeTier2);
    event SetNetworkFeePerc(uint256[] oldNetworkFeePerc, uint256[] newNetworkFeePerc);
    event SetCustomNetworkFeeTier(uint256 indexed oldCustomNetworkFeeTier, uint256 indexed newCustomNetworkFeeTier);
    event SetCustomNetworkFeePerc(uint256 oldCustomNetworkFeePerc, uint256 newCustomNetworkFeePerc);
    event SetTreasuryWallet(address indexed _treasuryWallet);
    event SetCommunityWallet(address indexed _communityWallet);
    event SetAdminWallet(address indexed _admin);
    event SetStrategistWallet(address indexed _strategistWallet);
    event SetPercTokenKeepInVault(uint256 _percentage);
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
      address _communityWallet, address _treasuryWallet, address _strategist, address _trustedForwarder, address _admin) external initializer {
        
        __ERC20_init(_name, _symbol);
        // __Ownable_init();
        
        poolId = _poolId;
        amountToKeepInVault = 500; //5%

        token0 = _token0;
        token1 = _token1;
        lpToken = _lpToken;
        lpPair = IUniswapV2Pair(address(_lpToken));
        communityWallet = _communityWallet;
        treasuryWallet = _treasuryWallet;
        strategist = _strategist;
        trustedForwarder = _trustedForwarder;
        admin = _admin;

        KashiPair = IKashiPair(0xF81F0d508132D25731436212D10E7D4A4f9068D2); //xSUSHI/USDC
        bentoBox = KashiPair.bentoBox();

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

    /// @notice Function that required for inherict BaseRelayRecipient
    function _msgSender() internal override(ContextUpgradeable, BaseRelayRecipient) view returns (address payable) {
        return BaseRelayRecipient._msgSender();
    }
    
    /// @notice Function that required for inherict BaseRelayRecipient
    function versionRecipient() external pure override returns (string memory) {
        return "1";
    }

    function _isTokenValid(IERC20Upgradeable _token) internal view {
        if(token0 == WETH) {
            //Accept ETH deposits only for ETH pairs (i.e WETH-USDC not for WBTC-USDC)
            require(_token == token0 || _token == token1 || address(_token) == address(0), "Invalid Token"); //address(0) - ETH (not WETH)
        } else {
            require(_token == token0 || _token == token1, "Invalid Token"); 
        }
    }
    /**
        @param _token Token to deposit. To deposit ETH, use address(0)    
        @param _amount amount of token to deposit.

        @dev For ETH send, msg.value is used instead of _amount
     */
    function deposit(IERC20Upgradeable _token, uint _amount) external payable {
        require(tx.origin == msg.sender || isTrustedForwarder(msg.sender), "only EOA");
        require(isEmergency == false ,"Deposit paused");
        _isTokenValid(_token);

        address _sender = _msgSender();

        if(address(_token) == address(0)) {
            require(msg.value > 0, "Invalid ETH sent");
        } else {
            require(_amount > 0, "Invalid token amount");
            _token.safeTransferFrom(_sender, address(this), _amount);
        }

        uint shares;
        uint lpTokenPool = balance();
        uint lpTokensSupplied = _deposit(address(_token), _amount);

        if(totalSupply() == 0) {
            shares = lpTokensSupplied;
        } else {
            shares = lpTokensSupplied.mul(totalSupply()).div(lpTokenPool);
        }

        _mint(_sender, shares);

        emit Deposit(address(_token), _sender, _amount, shares);
    }
    /**
        @param _token Token to deposit. To withdraw ETH, use address(0)    
        @param _shares shares to withdraw.
     */
    function withdraw(IERC20Upgradeable _token, uint _shares) external { 
        require(msg.sender == tx.origin, "Only EOA");
        _isTokenValid(_token);
        
        uint amountToWithdraw;
        uint lpTokenInPool = balance();
        uint amountOfLpsToWithdraw = lpTokenInPool.mul(_shares).div(totalSupply()); 

        uint lpInVault = available();
        if(amountOfLpsToWithdraw > lpInVault) {
            _withdrawFromPool(amountOfLpsToWithdraw.sub(lpInVault));
        }

        _withdrawFromKashi(amountOfLpsToWithdraw); //withdraw xSUSHI from kashi

        amountToWithdraw = amountOfLpsToWithdraw; // when lpToken is withdrawn by user

        if(_token != lpToken) {
            address[] memory path = new address[](2);

            if(address(_token) == address(0)) {
                //user withdraws in ETH

                (uint _token1Removed, )= SushiRouter.removeLiquidityETH(address(token1), amountOfLpsToWithdraw, 0, 0, address(this), block.timestamp);
                // (, uint _amount1) = SushiRouter.removeLiquidity(address(token0), address(token1), amountOfLpsToWithdraw, 0, 0, address(this), block.timestamp);    

                path[0] = address(token1);
                path[1] = address(WETH);
                // SushiRouter.swapExactTokensForTokens(_amount1, 0, path, address(this), block.timestamp);      
                SushiRouter.swapExactTokensForETH(_token1Removed, 0, path, address(this), block.timestamp);

                // amountToWithdraw = WETH.balanceOf(address(this));
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

        emit Withdraw(address(_token), msg.sender, amountToWithdraw, _shares);
    }

    function yield() external onlyAdmin{
        require(isEmergency == false ,"yield paused");
        _yield();

    }

    ///@dev Moves lpTokens from this contract to Masterchef
    function invest() external onlyAdmin {
        require(isEmergency == false ,"Invest paused");
        //keep some % of lpTokens in vault, deposit remaining to masterChef 
        _transferFee();
        uint balanceInVault = available(); //TODO check in option A
        uint amountToKeep = balance().mul(amountToKeepInVault).div(10000);
        if(balanceInVault > amountToKeep) { //lpToken in vault is greater than the amount to keep in vault
            _stakeToPool(balanceInVault.sub(amountToKeep));
        }
    }

    ///@dev Withdraws lpTokens from masterChef. Yield, invest functions will be paused
    function emergencyWithdraw() external onlyAdmin {    
        isEmergency = true;
        _yield();

        (uint lpTokenBalance, ) = MasterChef.userInfo(poolId, address(this));
        MasterChef.withdraw(poolId, lpTokenBalance);
        _withdrawFromKashi(balance());
    }

    ///@dev Moves funds in this contract to masterChef. ReEnables deposit, yield, invest.
    function reInvest() external onlyOwner {        
        uint lpTokenBalance = available();

        uint amountToKeep = lpTokenBalance.mul(amountToKeepInVault).div(10000);

        _stakeToPool(lpTokenBalance.sub(amountToKeep));

        isEmergency = false;
    }

    function setBiconomy(address _biconomy) external onlyOwner {
        trustedForwarder = _biconomy;
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

    //500 for 50%
    function setPercTokenKeepInVault(uint256 _percentage) external onlyAdmin {
        amountToKeepInVault = _percentage;
        emit SetPercTokenKeepInVault(_percentage);
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
        MasterChef.withdraw(poolId, _amount);
    }

    ///@dev swap to required lpToken. Deposit to masterChef in invest()
    function _deposit(address _token, uint _amount) internal returns(uint _lpTokens){
        
        //_token is not lpToken, so conver token to required pairs
        if(_token != address(lpToken)) {
            //address of _token is address(0) when ETH is used(not WETH) 
            uint[] memory _tokensAmount = _token == address(0) ? _swapETHToPairs() : _swapTokenToPairs(_token, _amount);

            //add liquidity to sushiSwap
            _lpTokens = _addLiquidity(_tokensAmount[0], _tokensAmount[1]); //token0, token1
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

    receive() external payable {
    }

    function _withdrawToUser(address payable _user, uint _amount, IERC20Upgradeable _token) internal {
        if(address(_token) == address(0)) {
            (bool success, ) = _user.call{value: _amount}(""); //add gas
            require(success, "Transfer failed");
        } else {
            _token.safeTransfer(_user, _amount);
        }

        xSUSHI.transfer(_user, xSUSHI.balanceOf(address(this)));
    }

    function _yield() internal {
        //check sushi balance
        //deposit sushi to sushibar(get xSUSHI)
        //_lendOnKashi
        MasterChef.deposit(poolId, 0); // To collect SUSHI
        uint sushiBalance = SUSHI.balanceOf(address(this));
        
        if(sushiBalance > 0) {
            //deposit sushi to sushiBar and get xSUSHI
            xSUSHI.enter(sushiBalance);

            //lend xSUSHI kashi
            _lendOnKashi(xSUSHI.balanceOf(address(this)));
        }
    }

    function _lendOnKashi(uint _amount) internal returns (uint _fraction){
        //calc bentobox shares
        uint _bentoShareEquivalent = _amount.mul(IERC20Upgradeable(bentoBox).totalSupply()).div(xSUSHI.balanceOf(bentoBox)); //TODO check //ref https://dev.sushi.com/bentobox/contracts
        _fraction = KashiPair.addAsset(address(this), true, _bentoShareEquivalent);
        fractions = fractions.add(_fraction);
    }

    function _withdrawFromKashi(uint _amount) internal {
        uint _fraction = fractions.mul(_amount).div(balance());  //TODO CHECK THIS AFTER UPDATING balance()
        KashiPair.removeAsset(address(this), _fraction);
    }

    function switchKashiLendingPool(IKashiPair _kashiPool) external onlyOwner {
        //Withdraw XSUSHI from old pool. //TODO
        KashiPair = _kashiPool;
        bentoBox = KashiPair.bentoBox();
        //deposit to new pool //TODO
    }


    ///@dev Converts ETH to WETH and swaps to required pair token
    function _swapETHToPairs() internal returns (uint[] memory _tokensAmount){
        
        (bool _status,) = payable(address(WETH)).call{value: msg.value}(""); //wrap ETH to WETH
        require(_status, 'ETH-WETH failed');
        
        address[] memory path = new address[](2);
        path[0] = address(WETH);
        path[1] = address(token1);
        
        
        _tokensAmount = SushiRouter.swapExactTokensForTokens(msg.value.div(2), 0, path, address(this), block.timestamp);

    }

    ///@dev swap to required pair tokens
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

    ///@dev Transfer fee from vault (in WETH). Fee will be transferred only when there is enough lpTokens as fee
    function _transferFee() internal onlyAdmin {
        (uint amount0, uint amount1) = getRemovedAmount(_fees); //Transaction may without this check.
        
        if(amount0 > 0 && amount1 > 0) {
            (uint _token0Amount, uint _token1Amount) = SushiRouter.removeLiquidity(address(token0), address(token1), _fees, 0, 0, address(this), block.timestamp);

            address[] memory path = new address[](2);
            path[0] = address(token1) ;
            path[1] = address(WETH);

            SushiRouter.swapExactTokensForTokens(_token1Amount, 0, path, address(this), block.timestamp);

            if(token0 != WETH) {
                //for farms without ETH
                path[0] == address(token0);
                SushiRouter.swapExactTokensForTokens(_token0Amount, 0, path, address(this), block.timestamp);
            }

            uint feeInEth  = WETH.balanceOf(address(this)); 
            uint feeSplit = feeInEth.mul(2).div(5);

            WETH.transfer(treasuryWallet, feeSplit); //40%
            WETH.transfer(communityWallet, feeSplit); //40%
            WETH.transfer(strategist, feeInEth.sub(feeSplit).sub(feeSplit)); //20%

            _fees = 0;
        }

    }

    ///@dev calculates the assets that will be removed for the give lpTokenAmount
    function getRemovedAmount(uint _inputAmount) internal returns (uint _amount0, uint _amount1){
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
        _available = lpToken.balanceOf(address(this)).sub(_fees);
    }

}



