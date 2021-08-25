// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
pragma abicoder v2;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../../../interfaces/INonfungiblePositionManager.sol";

contract uniVault is ERC20Upgradeable, ReentrancyGuardUpgradeable {

    
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public token0;
    IERC20Upgradeable public token1;

    INonfungiblePositionManager public constant nonfungiblePositionManager = INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

    uint feePerc;
    uint yieldFee;
    uint vaultPositionTokenId;
    uint totalLiquidity;
    uint private _feeToken0;
    uint private _feeToken1;

    uint24 poolFee; // uni v3 pool fee //3000 - 0.3 % fee tier

    int24 lowerTick;
    int24 upperTick;

    address public admin;
    address public treasury;
    address public communityWallet;
    address public strategist;

    mapping(uint => address) positionOwner;

    modifier onlyAdmin {
        require(msg.sender == admin, "only Admin");
        _;
    }

    
    function initialize(IERC20Upgradeable _token0, IERC20Upgradeable _token1, address _admin,
        address _communityWallet, address _treasury, address _strategist, 
        uint24 _uniPoolFee, int24 _lowerTick, int24 _upperTick) external initializer {
        
        __ERC20_init("uni_v3", "dao-uni"); 

        token0 = _token0;
        token1 = _token1;
        feePerc = 1000; //10 % 
        yieldFee = 5000; //5%
        poolFee = _uniPoolFee; //_uniPoolFee; //3000; //0.3 % fee tier
        lowerTick = _lowerTick; 
        upperTick = _upperTick; 

        admin = _admin;
        treasury = _treasury;
        communityWallet = _communityWallet;
        strategist = _strategist;

        IERC20Upgradeable(token0).approve( address(nonfungiblePositionManager), type(uint).max);
        IERC20Upgradeable(token1).approve( address(nonfungiblePositionManager), type(uint).max);
    }

    function deposit(uint _amount0, uint _amount1) external nonReentrant {
        require(_amount0 > 0 && _amount1 > 0, "amount should be greater than 0");

        token0.safeTransferFrom(msg.sender, address(this), _amount0);
        token1.safeTransferFrom(msg.sender, address(this), _amount1);

        (_amount0, _amount1) = _calcFee(_amount0, _amount1, 0);

        uint _liquidityAdded =_addLiquidity(_amount0, _amount1);
    
        uint _shares;
        if(totalSupply() == 0) {
            _shares = _liquidityAdded;
            totalLiquidity += _liquidityAdded;
        } else {            
            _shares = _liquidityAdded * totalSupply() / totalLiquidity;
            totalLiquidity += _liquidityAdded;
        }

        _mint(msg.sender, _shares);
    }

    function withdraw(uint _shares) external nonReentrant returns (uint _amount0, uint _amount1){
        require(_shares > 0, "invalid amount");

        uint _liquidity = totalLiquidity * _shares / totalSupply();
        totalLiquidity = totalLiquidity - _liquidity;

        INonfungiblePositionManager.DecreaseLiquidityParams memory params =
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: vaultPositionTokenId,
                liquidity: uint128(_liquidity),
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        //decrease liquidity to collect deposit fee
        (_amount0, _amount1) = nonfungiblePositionManager.decreaseLiquidity(params);

        _collect(_amount0, _amount1);

        _burn(msg.sender, _shares);
        
        if(_amount0 > 0) {
            token0.safeTransfer(msg.sender, _amount0);
        }

        if(_amount1 > 0) {
            token1.safeTransfer(msg.sender, _amount1);
        }

    }

    function yield() external onlyAdmin{ 
        
        (uint _amt0Collected, uint _amt1Collected) = _collect(type(uint128).max, type(uint128).max);

        if(_amt0Collected >0 && _amt1Collected > 0) {
            _calcFee(_amt0Collected, _amt0Collected, 1);
            
            (uint _amt0, uint _amt1 ) = _available();
    
            uint _liquidityAdded = _addLiquidity(_amt0, _amt1);
        
            totalLiquidity += _liquidityAdded;
        
            _transferFee();
        }
        
    }

    function changeTicks(int24 _upper, int24 _lower) external onlyAdmin{

        (uint _amt0, uint _amt1) = _decreaseLiquidity(totalLiquidity);

        (_amt0, _amt1) = _collect(_amt0, _amt1);

        lowerTick = _lower;
        upperTick = _upper;
        
        vaultPositionTokenId = 0;
        uint _liquidity = _addLiquidity(_amt0, _amt1);
         
        totalLiquidity = _liquidity;
    }

    function setTreasury(address _treasury) external onlyAdmin {
        treasury = _treasury;
    }

    function setCommunityWallet(address _communityWallet) external onlyAdmin {
        communityWallet = _communityWallet;
    }

    function setStrategist(address _strategist) external onlyAdmin {
        strategist = _strategist;
    }

    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }

    function setFee(uint _feePerc, uint _yieldFee) external onlyAdmin {
        feePerc = _feePerc; //deposit fee
        yieldFee =_yieldFee; //yield Fee
    }

    function transferFee() external onlyAdmin{
        _transferFee();
    }

    function _transferFee() internal {
        if(_feeToken0 > 0 && _feeToken1 > 0) {

            uint _feeSplit = _feeToken0*2/5;
            uint _feeSplit1 = _feeToken1*2/5;

            token0.safeTransfer(treasury, _feeSplit);
            token0.safeTransfer(communityWallet, _feeSplit);
            token0.safeTransfer(strategist, _feeToken0-_feeSplit-_feeSplit);

            token1.safeTransfer(treasury, _feeSplit1);
            token1.safeTransfer(communityWallet, _feeSplit1);
            token1.safeTransfer(strategist, _feeToken1-_feeSplit1-_feeSplit1);            
        }

    }

    function _addLiquidity(uint _amount0, uint _amount1) internal returns (uint _liquidity){
        
        if(vaultPositionTokenId == 0) {
            // add liquidity for the first time
            INonfungiblePositionManager.MintParams memory params =
                INonfungiblePositionManager.MintParams({
                    token0: address(token0),
                    token1: address(token1),
                    fee: poolFee,
                    tickLower: lowerTick, 
                    tickUpper: upperTick, 
                    amount0Desired: _amount0,
                    amount1Desired: _amount1,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp
                });

            (uint _tokenId, uint liquidity, ,) = nonfungiblePositionManager.mint(params);
            
            vaultPositionTokenId = _tokenId;

            return liquidity;

        } else {

            INonfungiblePositionManager.IncreaseLiquidityParams memory params =
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: vaultPositionTokenId,
                    amount0Desired: _amount0,
                    amount1Desired: _amount1,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                });

            (uint liquidity, , ) = nonfungiblePositionManager.increaseLiquidity(params);

            return liquidity;
        }
    }

    function _decreaseLiquidity(uint _liquidity) internal returns (uint _amt0, uint _amt1){
         INonfungiblePositionManager.DecreaseLiquidityParams memory params =
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: vaultPositionTokenId,
                liquidity: uint128(_liquidity),
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        //decrease liquidity to collect deposit fee
        (_amt0, _amt1) = nonfungiblePositionManager.decreaseLiquidity(params);
    }

    function _collect(uint _amount0, uint _amount1) internal returns (uint _amt0Collected, uint _amt1Collected){

        INonfungiblePositionManager.CollectParams memory collectParams =
            INonfungiblePositionManager.CollectParams({
                tokenId: vaultPositionTokenId,
                recipient: address(this),
                amount0Max: uint128(_amount0),
                amount1Max: uint128(_amount1)
            });

        (_amt0Collected, _amt1Collected) =  nonfungiblePositionManager.collect(collectParams);
    }

    //type == 0 for depositFee
    function _calcFee(uint _amount0, uint _amount1, uint _type) internal returns (uint _amt0AfterFee, uint _amt1AfterFee){
        //both tokens added as liquidity
        uint _half = _type == 0 ? feePerc/2 : yieldFee/2;
        uint _fee0 = _amount0*_half/10000;
        uint _fee1 = _amount1*_half/10000;
        
        _feeToken0 = _feeToken0+_fee0;
        _feeToken1 = _feeToken1+_fee1;

        _amt0AfterFee = _amount0 - _fee0;
        _amt1AfterFee = _amount1 - _fee1;

    }

    function _available() internal view returns (uint _amt0, uint _amt1) {
        _amt0 = token0.balanceOf(address(this)) - _feeToken0;
        _amt1 = token1.balanceOf(address(this)) - _feeToken1;
    }


}