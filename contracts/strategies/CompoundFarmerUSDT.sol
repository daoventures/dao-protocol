// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../interfaces/ICERC20.sol";
import "../../interfaces/ICOMPERC20.sol";
import "../../interfaces/IComptroller.sol";
import "../../interfaces/IDAOVault.sol";
import "../../interfaces/IUniswapV2Router02.sol";

import "hardhat/console.sol";

contract CompoundFarmerUSDT is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for ICOMPERC20;
    using SafeMath for uint256;

    IERC20 public token;
    ICERC20 public cToken;
    ICOMPERC20 public compToken;
    IComptroller public comptroller;
    IUniswapV2Router02 public uniswapRouter;
    IDAOVault public DAOVault;
    address public WETH;
    uint256 private constant MAX_UNIT = 2**256 - 2;
    bool public isVesting = false;
    uint256 public pool;

    // For Uniswap
    uint256 public amountOutMinPerc = 9500;
    uint256 public deadline = 20 minutes;

    // Address to collect fees
    address public treasuryWallet = 0x59E83877bD248cBFe392dbB5A8a29959bcb48592;
    address public communityWallet = 0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0;

    // Calculation for fees
    uint256[] public networkFeeTier2 = [50000e6+1, 100000e6]; // Represent [tier2 minimun, tier2 maximun], initial value represent Tier 2 from 50001 to 100000
    uint256 public customNetworkFeeTier = 1000000e6;

    uint256 public constant DENOMINATOR = 10000;
    uint256[] public networkFeePercentage = [100, 75, 50]; // Represent [Tier 1, Tier 2, Tier 3], initial value represent [1%, 0.75%, 0.5%]
    uint256 public customNetworkFeePercentage = 25;
    uint256 public profileSharingFeePercentage = 1000;
    uint256 public constant treasuryFee = 5000; // 50% on profile sharing fee
    uint256 public constant communityFee = 5000; // 50% on profile sharing fee

    event SetTreasuryWallet(address indexed oldTreasuryWallet, address indexed newTreasuryWallet);
    event SetCommunityWallet(address indexed oldCommunityWallet, address indexed newCommunityWallet);
    event SetNetworkFeeTier2(uint256[] oldNetworkFeeTier2, uint256[] newNetworkFeeTier2);
    event SetNetworkFeePercentage(uint256[] oldNetworkFeePercentage, uint256[] newNetworkFeePercentage);
    event SetCustomNetworkFeeTier(uint256 oldCustomNetworkFeeTier, uint256 newCustomNetworkFeeTier);
    event SetCustomNetworkFeePercentage(uint256 oldCustomNetworkFeePercentage, uint256 newCustomNetworkFeePercentage);
    event SetProfileSharingFeePercentage(uint256 indexed oldProfileSharingFeePercentage, uint256 indexed newProfileSharingFeePercentage);

    constructor(address _token, address _cToken, address _compToken, address _comptroller, address _uniswapRouter, address _WETH)
        ERC20("Compound-Farmer USDT", "cfUSDT") {
            _setupDecimals(6);

            token = IERC20(_token);
            cToken = ICERC20(_cToken);
            compToken = ICOMPERC20(_compToken);
            comptroller = IComptroller(_comptroller);
            uniswapRouter = IUniswapV2Router02(_uniswapRouter);
            WETH = _WETH;

            token.safeApprove(address(cToken), MAX_UNIT);
        }

    function setVault(address _address) external onlyOwner {
        require(address(DAOVault) == address(0), "Vault set");

        DAOVault = IDAOVault(_address);
    }

    function initialDeposit() external onlyOwner {
        require(isVesting == false, "Contract in vesting state");
        uint256 _amount = token.balanceOf(address(this));
        require(_amount > 0, "No balance to network");

        uint256 error = cToken.mint(_amount);
        require(error == 0, "Failed to lend into Compound");
    }

    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        address oldTreasuryWallet = treasuryWallet;
        treasuryWallet = _treasuryWallet;
        emit SetTreasuryWallet(oldTreasuryWallet, _treasuryWallet);
    }

    function setCommunityWallet(address _communityWallet) external onlyOwner {
        address oldCommunityWallet = communityWallet;
        communityWallet = _communityWallet;
        emit SetCommunityWallet(oldCommunityWallet, _communityWallet);
    }

    function setNetworkFeeTier2(uint256[] calldata _networkFeeTier2) external onlyOwner {
        require(_networkFeeTier2[0] != 0, "Minimun amount cannot be 0");
        require(_networkFeeTier2[1] > _networkFeeTier2[0], "Maximun amount must greater than minimun amount");

        uint256[] memory oldNetworkFeeTier2 = networkFeeTier2;
        networkFeeTier2 = _networkFeeTier2;
        emit SetNetworkFeeTier2(oldNetworkFeeTier2, _networkFeeTier2);
    }

    function setCustomNetworkFeeTier(uint256 _customNetworkFeeTier) external onlyOwner {
        require(_customNetworkFeeTier > networkFeeTier2[1], "Custom network fee tier must greater than tier 2");

        uint256 oldCustomNetworkFeeTier = customNetworkFeeTier;
        customNetworkFeeTier = _customNetworkFeeTier;
        emit SetCustomNetworkFeeTier(oldCustomNetworkFeeTier, _customNetworkFeeTier);
    }

    function setNetworkFeePercentage(uint256[] calldata _networkFeePercentage) external onlyOwner {
        require(
            _networkFeePercentage[0] < 3000 && 
            _networkFeePercentage[1] < 3000 && 
            _networkFeePercentage[2] < 3000, "Network fee percentage cannot be more than 30%"
        );

        uint256[] memory oldNetworkFeePercentage = networkFeePercentage;
        networkFeePercentage = _networkFeePercentage;
        emit SetNetworkFeePercentage(oldNetworkFeePercentage, _networkFeePercentage);
    }

    function setCustomNetworkFeePercentage(uint256 _percentage) public onlyOwner {
        require(_percentage < networkFeePercentage[2], "Custom network fee percentage cannot be more than tier 2");

        uint256 oldCustomNetworkFeePercentage = customNetworkFeePercentage;
        customNetworkFeePercentage = _percentage;
        emit SetCustomNetworkFeePercentage(oldCustomNetworkFeePercentage, _percentage);
    }

    function setProfileSharingFeePercentage(uint256 _percentage) public onlyOwner {
        require(_percentage < 3000, "Profile sharing fee percentage cannot be more than 30%");

        uint256 oldProfileSharingFeePercentage = profileSharingFeePercentage;
        profileSharingFeePercentage = _percentage;
        emit SetProfileSharingFeePercentage(oldProfileSharingFeePercentage, _percentage);
    }

    function setAmountOutMinPerc(uint256 _percentage) external onlyOwner {
        require(_percentage <= 9700, "Amount out minimun > 97%");
        amountOutMinPerc = _percentage;
    }

    function setDeadline(uint256 _seconds) external onlyOwner {
        require(_seconds >= 60, "Deadline < 60 seconds");
        deadline = _seconds;
    }

    function getCurrentBalance(address _address) external view returns (uint256) {
        uint256 _shares = DAOVault.balanceOf(_address);
        if (_shares > 0) {
            return pool.mul(_shares).div(totalSupply());
        } else {
            return 0;
        }
    }

    function deposit(uint256 _amount) external {
        require(isVesting == false, "Contract in vesting state");
        require(msg.sender == address(DAOVault), "Only can call from Vault");

        token.safeTransferFrom(tx.origin, address(this), _amount);

        uint256 _networkFeePercentage;
        if (_amount < networkFeeTier2[0]) { // Tier 1
            _networkFeePercentage = networkFeePercentage[0];
        } else if (_amount >= networkFeeTier2[0] && _amount <= networkFeeTier2[1]) { // Tier 2
            _networkFeePercentage = networkFeePercentage[1];
        } else if (_amount > networkFeeTier2[1] && _amount < customNetworkFeeTier) { // Tier 3
            _networkFeePercentage = networkFeePercentage[2];
        } else {
            _networkFeePercentage = customNetworkFeePercentage;
        }

        uint256 _fee = _amount.mul(_networkFeePercentage).div(DENOMINATOR);
        _amount = _amount.sub(_fee);
        uint256 error = cToken.mint(_amount);
        require(error == 0, "Failed to lend into Compound");
        token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
        token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));

        uint256 _shares;
        if (totalSupply() == 0) {
            _shares = _amount;
        } else {
            _shares = _amount.mul(totalSupply()).div(pool);
        }
        pool = pool.add(_amount);
        _mint(address(DAOVault), _shares);
    }

    function withdraw(uint256 _amount) external {
        require(isVesting == false, "Contract in vesting state");
        require(msg.sender == address(DAOVault), "Only can call from Vault");
        uint256 _shares = _amount.mul(totalSupply()).div(pool);
        require(DAOVault.balanceOf(tx.origin) >= _shares, "Insufficient balance");

        ICERC20[] memory _cTokens = new ICERC20[](1);
        _cTokens[0] = cToken;
        comptroller.claimComp(address(this), _cTokens);

        uint256 _cTokenBalance = cToken.balanceOf(address(this)).mul(_amount).div(pool);
        uint256 error = cToken.redeem(_cTokenBalance);
        require(error == 0, "Failed to redeem from Compound");

        if (compToken.balanceOf(address(this)) > 0) {
            uint256 _amountIn = compToken.balanceOf(address(this)).mul(_amount).div(pool);
            compToken.safeApprove(address(uniswapRouter), _amountIn);

            address[] memory _path = new address[](3);
            _path[0] = address(compToken);
            _path[1] = WETH;
            _path[2] = address(token);

            uint256[] memory _amountsOut = uniswapRouter.getAmountsOut(_amountIn, _path);
            if (_amountsOut[2] > 0) {
                uint256 _amountOutMin = _amountsOut[2].mul(amountOutMinPerc).div(DENOMINATOR);
                uniswapRouter.swapExactTokensForTokens(_amountIn, _amountOutMin, _path, address(this), block.timestamp.add(deadline));
            }
        }

        uint256 _r = token.balanceOf(address(this));
        if (_r > _amount) {
            uint256 _p = _r.sub(_amount);
            uint256 _fee = _p.mul(profileSharingFeePercentage).div(DENOMINATOR);
            token.safeTransfer(tx.origin, _r.sub(_fee));
            token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
            token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
        } else {
            token.safeTransfer(tx.origin, _r);
        }

        pool = pool.sub(_amount);
        _burn(address(DAOVault), _shares);
    }

    function vesting() external onlyOwner {
        require(isVesting == false, "Already in vesting state");

        ICERC20[] memory _cTokens = new ICERC20[](1);
        _cTokens[0] = cToken;
        comptroller.claimComp(address(this), _cTokens);

        // Withdraw all funds from Compound
        uint256 _cTokenAll = cToken.balanceOf(address(this));
        if (_cTokenAll > 0) {
            uint256 error = cToken.redeem(_cTokenAll);
            require(error == 0, "Failed to redeem from Compound");
        }

        if (compToken.balanceOf(address(this)) > 0) {
            // Exchange all compToken
            uint256 _amountIn = compToken.balanceOf(address(this));
            compToken.safeApprove(address(uniswapRouter), _amountIn);

            address[] memory _path = new address[](3);
            _path[0] = address(compToken);
            _path[1] = WETH;
            _path[2] = address(token);

            uint256[] memory _amountsOut = uniswapRouter.getAmountsOut(_amountIn, _path);
            if (_amountsOut[2] > 0) {
                uint256 _amountOutMin = _amountsOut[2].mul(amountOutMinPerc).div(DENOMINATOR);
                uniswapRouter.swapExactTokensForTokens(_amountIn, _amountOutMin, _path, address(this), block.timestamp.add(deadline));
            }
        }

        // Collect all fees
        uint256 _r = token.balanceOf(address(this));
        if (_r > pool) {
            uint256 _p = _r.sub(pool);
            uint256 _fee = _p.mul(profileSharingFeePercentage).div(DENOMINATOR);
            token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
            token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
        }

        pool = token.balanceOf(address(this));
        isVesting = true;
    }

    function refund(uint256 _shares) external {
        require(isVesting == true, "Not in vesting state");
        require(msg.sender == address(DAOVault), "Only can call from Vault");

        uint256 _refundAmount = pool.mul(_shares).div(totalSupply());
        token.safeTransfer(tx.origin, _refundAmount);
        pool = pool.sub(_refundAmount);
        _burn(address(DAOVault), _shares);
    }

    function revertVesting() external {
        require(isVesting == true, "Not in vesting state");

        isVesting = false;
    }

    function approveMigrate() external onlyOwner {
        require(isVesting == true, "Not in vesting state");

        if (token.allowance(address(this), address(DAOVault)) == 0) {
            token.safeApprove(address(DAOVault), MAX_UNIT);
        }
    }
}
