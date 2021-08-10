pragma solidity 0.7.6;

// import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

import "../../../libs/BaseRelayRecipient.sol";
import "../../../interfaces/IRelayRecipient.sol";
import "../../../interfaces/IUniswapV2Router01.sol";
import "../../../interfaces/IUniswapV2Pair.sol";
import "../../../interfaces/IMasterChef.sol";
import "../../../interfaces/IxSUSHI.sol";
import "../../../interfaces/IKashiPair.sol";
import "../../../interfaces/IBentoBox.sol";
import "../../../interfaces/IWETH.sol";
// import "hardhat/console.sol";

interface Factory {
    function owner() external view returns (address);
}

contract DAOVaultOptionB is Initializable, ERC20Upgradeable, BaseRelayRecipient{
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IUniswapV2Router01 public SushiRouter ;
    IMasterChef public MasterChef; 

    IERC20Upgradeable public lpToken; 
    IWETH public WETH ; 
    IERC20Upgradeable public WBTC ; 
    IERC20Upgradeable public SUSHI ; 
    IERC20Upgradeable public token0;
    IERC20Upgradeable public token1;
    IUniswapV2Pair public lpPair;
    Factory public factory;
    IxSUSHI public xSUSHI ;
    IKashiPair public KashiPair;

    address public admin; 
    address public treasuryWallet;
    address public communityWallet;
    address public strategist;
    IBentoBox private bentoBox;

    uint public poolId;
    uint public amountToKeepInVault; //500 //5 %
    uint[] public networkFeeTier2;
    uint public customNetworkFeeTier;
    uint[] public networkFeePerc;
    uint public customNetworkFeePerc;
    
    uint private _fees; // 18 decimals
    uint private _xSushiFee;
    uint private masterChefVersion;

    bool isEmergency;

    mapping(address => uint) public depositedAmount;

    event Yield(uint _yieldAmount);
    event SetNetworkFeeTier2(uint256[] oldNetworkFeeTier2, uint256[] newNetworkFeeTier2);
    event SetNetworkFeePerc(uint256[] oldNetworkFeePerc, uint256[] newNetworkFeePerc);
    event SetCustomNetworkFeeTier(uint256 indexed oldCustomNetworkFeeTier, uint256 indexed newCustomNetworkFeeTier);
    event SetCustomNetworkFeePerc(uint256 oldCustomNetworkFeePerc, uint256 newCustomNetworkFeePerc);
    event SetPercTokenKeepInVault(uint256 _percentage);
    event Deposit(address indexed _token, address _from, uint _amount, uint _sharesMinted);
    event Withdraw(address indexed _token, address _from, uint _amount, uint _sharesBurned);

    uint256[49] private __gap;

    ///@dev For ETH-token pairs, _token0 should be ETH 
    function initialize(string memory _name, string memory _symbol, uint _poolId, 
      IERC20Upgradeable _token0, IERC20Upgradeable _token1, IERC20Upgradeable _lpToken,
      address _communityWallet, address _treasuryWallet, address _strategist, address _trustedForwarder, address _admin,
      address _masterchef, uint _masterChefVersion) external initializer {
        
        __ERC20_init(_name, _symbol);
        // __Ownable_init();
        SushiRouter = IUniswapV2Router01(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);    
        WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); 
        WBTC = IERC20Upgradeable(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599); 
        SUSHI = IERC20Upgradeable(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2); 
        xSUSHI = IxSUSHI(0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272);
        
        poolId = _poolId;
        amountToKeepInVault = 500; //5%
        masterChefVersion = _masterChefVersion;

        token0 = _token0;
        token1 = _token1;
        lpToken = _lpToken;
        lpPair = IUniswapV2Pair(address(_lpToken));
        communityWallet = _communityWallet;
        treasuryWallet = _treasuryWallet;
        strategist = _strategist;
        trustedForwarder = _trustedForwarder;
        admin = _admin;

        MasterChef = IMasterChef(_masterchef); 
        KashiPair = IKashiPair(0xF81F0d508132D25731436212D10E7D4A4f9068D2); //xSUSHI/USDC
        bentoBox = IBentoBox(KashiPair.bentoBox());

        factory = Factory(msg.sender);

        networkFeeTier2 = [50000*1e18+1, 100000*1e18];
        customNetworkFeeTier = 1000000*1e18;
        networkFeePerc = [100, 75, 50];
        customNetworkFeePerc = 25;

        token0.safeApprove(address(SushiRouter), type(uint).max);
        token1.safeApprove(address(SushiRouter), type(uint).max);
        // WBTC.safeApprove(address(SushiRouter), type(uint).max);
        lpToken.safeApprove(address(SushiRouter), type(uint).max);
        lpToken.safeApprove(address(MasterChef), type(uint).max);
        SUSHI.safeApprove(address(SushiRouter), type(uint).max);
        SUSHI.safeApprove(address(xSUSHI), type(uint).max);
        xSUSHI.approve(address(bentoBox), type(uint).max);
        xSUSHI.approve(address(KashiPair), type(uint).max);
        xSUSHI.approve(address(SushiRouter), type(uint).max);

        bentoBox.setMasterContractApproval(address(this), address(KashiPair.masterContract()), true, 0, 0, 0);

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
        if(address(token0) == address(WETH)) {
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
            require(msg.value > 0, "ETH == 0");
        } else {
            require(_amount > 0, "token == 0");
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

        _mint(_sender, lpTokensSupplied);

        emit Deposit(address(_token), _sender, _amount, shares);
    }
    /**
        @param _token Token to deposit. To withdraw ETH, use address(0)    
        @param _shares shares to withdraw.
     */
    function withdraw(IERC20Upgradeable _token, uint _shares) external { 
        require(msg.sender == tx.origin, "Only EOA");
        require(_shares > 0, "invalid shares");
        require(balanceOf(msg.sender) >= _shares, "Invalid amount");

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

                // //user withdraws in one of underlying token
                (uint _amount0, uint _amount1) = SushiRouter.removeLiquidity(address(token0), address(token1), amountOfLpsToWithdraw, 0, 0, address(this), block.timestamp);    
                // console.log('removed', _amount0, _amount1);
                path[0] = _token == token0 ? address(token1) : address(token0); //other token frm withdrawn token
                path[1] = address(_token); //withdrawn token
                
                SushiRouter.swapExactTokensForTokens(_token == token0 ? _amount1 : _amount0, 0, path, address(this), block.timestamp);     
                
                amountToWithdraw = _token.balanceOf(address(this));

        }

        _burn(msg.sender, _shares);

        _withdrawToUser(msg.sender, amountToWithdraw, _token);

        emit Withdraw(address(_token), msg.sender, amountToWithdraw, amountOfLpsToWithdraw);
    }

    function yield() external /* onlyAdmin */{
        require(msg.sender == admin, "Only Admin");
        require(isEmergency == false ,"yield paused");
        _yield();

    }

    ///@dev Moves lpTokens from this contract to Masterchef
    function invest() external /* onlyAdmin */ {
        require(msg.sender == admin, "Only Admin");
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
    function emergencyWithdraw() external /* onlyAdmin */ {    
        require(msg.sender == admin, "Only Admin");
        isEmergency = true;
        _yield();

        (uint lpTokenBalance, ) = MasterChef.userInfo(poolId, address(this));
        _withdrawFromPool(lpTokenBalance);
        // MasterChef.withdraw(poolId, lpTokenBalance);
        _withdrawFromKashi(balance());
    }

    ///@dev Moves funds in this contract to masterChef. ReEnables deposit, yield, invest.
    function reInvest() external /* onlyOwner */ {     
        require(msg.sender == factory.owner(), "only Owner");   
        uint lpTokenBalance = available();

        uint amountToKeep = lpTokenBalance.mul(amountToKeepInVault).div(10000);

        _stakeToPool(lpTokenBalance.sub(amountToKeep));

        isEmergency = false;
    }

    function setBiconomy(address _biconomy) external /* onlyOwner */ {
        require(msg.sender == factory.owner(), "only Owner");
        trustedForwarder = _biconomy;
    }

    /// @notice Function to set new network fee for deposit amount tier 2
    /// @param _networkFeeTier2 Array that contains minimum and maximum amount of tier 2 (18 decimals)
    function setNetworkFeeTier2(uint256[] calldata _networkFeeTier2) external /* onlyOwner */ {
        require(msg.sender == factory.owner(), "only Owner");
        require(_networkFeeTier2[0] != 0, "cannot be 0");
        require(_networkFeeTier2[1] > _networkFeeTier2[0], "max < min");
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
    function setCustomNetworkFeeTier(uint256 _customNetworkFeeTier) external /* onlyOwner */ {
        require(msg.sender == factory.owner(), "only Owner");
        require(_customNetworkFeeTier > networkFeeTier2[1], " tier < tier 2");

        uint256 oldCustomNetworkFeeTier = customNetworkFeeTier;
        customNetworkFeeTier = _customNetworkFeeTier;
        emit SetCustomNetworkFeeTier(oldCustomNetworkFeeTier, _customNetworkFeeTier);
    }

    /// @notice Function to set new network fee percentage
    /// @param _networkFeePerc Array that contains new network fee percentage for tier 1, tier 2 and tier 3
    function setNetworkFeePerc(uint256[] calldata _networkFeePerc) external /* onlyOwner */ {
        require(msg.sender == factory.owner(), "only Owner");
        require(
            _networkFeePerc[0] < 3000 &&
                _networkFeePerc[1] < 3000 &&
                _networkFeePerc[2] < 3000,
            "max 30%"
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
    function setCustomNetworkFeePerc(uint256 _percentage) public /* onlyOwner */ {
        require(msg.sender == factory.owner(), "only Owner");
        require(_percentage < networkFeePerc[2], "PERC Invalid");

        uint256 oldCustomNetworkFeePerc = customNetworkFeePerc;
        customNetworkFeePerc = _percentage;
        emit SetCustomNetworkFeePerc(oldCustomNetworkFeePerc, _percentage);
    }

    //500 for 50%
    function setPercTokenKeepInVault(uint256 _percentage) external /* onlyAdmin */ {
        require(msg.sender == admin, "Only Admin");
        amountToKeepInVault = _percentage;
        emit SetPercTokenKeepInVault(_percentage);
    }

    function setTreasuryWallet(address _treasuryWallet) external /* onlyAdmin */ {
        require(msg.sender == admin, "Only Admin");
        treasuryWallet = _treasuryWallet;
        // emit SetTreasuryWallet(_treasuryWallet);
    }

    function setCommunityWallet(address _communityWallet) external /* onlyAdmin */ {
        require(msg.sender == admin, "Only Admin");
        communityWallet = _communityWallet;
        // emit SetCommunityWallet(_communityWallet);
    }

    function setStrategistWallet(address _strategistWallet) external /* onlyAdmin */ {
        require(msg.sender == admin, "Only Admin");
        strategist = _strategistWallet;
        // emit SetStrategistWallet(_strategistWallet);
    }

    ///@dev swap to required lpToken. Deposit to masterChef in invest()
    function _deposit(address _token, uint _amount) internal returns(uint _lpTokens){
        
        //_token is not lpToken, so conver token to required pairs
        if(_token != address(lpToken)) {
            //address of _token is address(0) when ETH is used(not WETH) 
            uint[] memory _tokensAmount = _token == address(0) ? _swapETHToPairs() : _swapTokenToPairs(_token, _amount);
            // console.log('_deposit', WETH.balanceOf(address(this)), token1.balanceOf(address(this)));
            //add liquidity to sushiSwap
            _lpTokens = _addLiquidity(_tokensAmount[0], _tokensAmount[1]); //token0, token1
            // (,,_lpTokens) = SushiRouter.addLiquidity(address(token0), address(token1), _tokensAmount[0], _tokensAmount[1], 0, 0, address(this), block.timestamp);
        }  else {
            _lpTokens = _amount;
        }

        _calcFee(_lpTokens);
    }

    function _calcFee(uint _lpTokens) internal {
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
        if(masterChefVersion == 1 ) {
            MasterChef.withdraw(poolId, _amount);
        } else {
            MasterChef.withdraw(poolId, _amount, address(this));
        }
        
    }

    receive() external payable {
    }

    function _withdrawToUser(address payable _user, uint _amount, IERC20Upgradeable _token) internal {
        if(address(_token) == address(0)) {
            WETH.withdraw(_amount);
            (bool success, ) = _user.call{value: _amount}(""); //add gas
            require(success, "Transfer failed");
        } else {
            _token.safeTransfer(_user, _amount);
        }
        // console.log('withdrawn', _amount, xSUSHIAvailable());
        xSUSHI.transfer(_user, xSUSHIAvailable());
    }

    function _yield() internal {
        //check sushi balance
        //deposit sushi to sushibar(get xSUSHI)
        //_lendOnKashi
        
        if(masterChefVersion == 1) {
            MasterChef.deposit(poolId, 0); // To collect SUSHI
        } else {
            //dual rewards on version 2 
            //on masterChefV2 - sushi rewards should be claimed maunally
            MasterChef.harvest(poolId, address(this)); //claim sushi rewards

            //swap token reward to pair and deposit 
            uint[] memory _tokensAmount = _swapTokenToPairs(address(token1), token1.balanceOf(address(this)));
            uint lpTokenAmount = _addLiquidity(_tokensAmount[0], _tokensAmount[1]);
            // (,,uint lpTokenAmount) = SushiRouter.addLiquidity(address(token0), address(token1), _tokensAmount[0], _tokensAmount[1], 0, 0, address(this), block.timestamp);

            uint fee = lpTokenAmount.mul(2000).div(10000);
            _fees = _fees.add(fee);

            _stakeToPool(lpTokenAmount.sub(fee));
        }
        
        uint sushiBalance = SUSHI.balanceOf(address(this));
        
        KashiPair.withdrawFees();

        if(sushiBalance > 0) {
            //deposit sushi to sushiBar and get xSUSHI
            xSUSHI.enter(sushiBalance);
            uint xsushiBalance = xSUSHIAvailable();
            uint xsushiFee = xsushiBalance.mul(2000).div(10000); //20%

            _xSushiFee = _xSushiFee.add(xsushiFee);
            //lend xSUSHI kashi
            _lendOnKashi(xsushiBalance.sub(xsushiFee));
        }
    }

    function _lendOnKashi(uint _amount) internal returns (uint _fraction){
        (,uint _bentoShares) = bentoBox.deposit(address(xSUSHI), address(this), address(this), _amount, 0);
        _fraction = KashiPair.addAsset(address(this), false, _bentoShares);
    }

    function _withdrawFromKashi(uint _amount) internal {
        uint _fraction = KashiPair.balanceOf(address(this)).mul(_amount).div(balance());  
        uint _bentoShares = KashiPair.removeAsset(address(this), _fraction);
        bentoBox.withdraw(address(xSUSHI), address(this), address(this), 0, _bentoShares);
    }

    function switchKashiLendingPool(IKashiPair _kashiPool) external /* onlyOwner */ {
        require(msg.sender == factory.owner(), "only Owner");
        //Withdraw XSUSHI from old pool.
        _withdrawFromKashi(balance()); //withdraw all xSUSHI
        KashiPair = _kashiPool;
        bentoBox = IBentoBox(KashiPair.bentoBox());
        //deposit to new pool
        _lendOnKashi(xSUSHIAvailable());
    }


    ///@dev Converts ETH to WETH and swaps to required pair token
    function _swapETHToPairs() internal returns (uint[] memory _tokensAmount){
        
        (bool _status,) = payable(address(WETH)).call{value: msg.value}(""); //wrap ETH to WETH
        require(_status, 'WETH fail');
        
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
        uint[] memory _tokensAmountTemp = SushiRouter.swapExactTokensForTokens(_amount.div(2), 0, path, address(this), block.timestamp);

        //swap token order. first element should be token0
        if(_token != address(token0)) {
            _tokensAmount = new uint[](2);
            _tokensAmount[0] = _tokensAmountTemp[1];
            _tokensAmount[1] = _tokensAmountTemp[0];
        } else {
            _tokensAmount = _tokensAmountTemp;
        }        

        // if()
        // _tokensAmount = _token == address(token0) ? [_tokensAmount[0], _tokensAmount[1]] :[_tokensAmount[0], _tokensAmount[1]];
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

    ///@dev Transfer fee from vault (in WETH). Fee will be transferred only when there is enough lpTokens as fee
    function _transferFee() internal {
        (uint amount0, uint amount1) = getRemovedAmount(_fees); //Transaction may fail without this check.

        if(amount0 > 0 && amount1 > 0) {
            (, uint _token1Amount) = SushiRouter.removeLiquidity(address(token0), address(token1), _fees, 0, 0, address(this), block.timestamp);
            // console.log("BTC, IBTC", _token0Amount, _token1Amount);
            address[] memory path = new address[](2);

            if(token0 == WBTC) {
                //pair-WETH doesn't exists for some pairs
                path[0] = address(token1);
                path[1] = address(WBTC);
                
                uint[] memory amounts = SushiRouter.swapExactTokensForTokens(_token1Amount, 0, path, address(this), block.timestamp);
        
                path[0] = address(WBTC);
                path[1] = address(WETH);
                SushiRouter.swapExactTokensForTokens(amounts[1], 0, path, address(this), block.timestamp);
            } else {
                path[0] = address(token1) ;
                path[1] = address(WETH); 

                SushiRouter.swapExactTokensForTokens(_token1Amount, 0, path, address(this), block.timestamp);
            }

            //swap xSUSHI to WETH

            if(_xSushiFee > 0) {
                path[0] = address(xSUSHI);
                SushiRouter.swapExactTokensForTokens(_xSushiFee, 0, path, address(this), block.timestamp);
                _xSushiFee = 0;
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
        _available = lpToken.balanceOf(address(this)).sub(_fees);
    }

    function xSUSHIAvailable() public view returns(uint _available){
        _available = xSUSHI.balanceOf(address(this)).sub(_xSushiFee);
    }

}



