// SPDX-Licence-Identifier: MIT
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "hardhat/console.sol";

interface ICERC20 is IERC20 {
    function mint(uint256) external returns (uint256);

    function redeem(uint256) external returns (uint256);

    function redeemUnderlying(uint256) external returns (uint256);

    function balanceOfUnderlying(address) external returns (uint256);

    function supplyRatePerBlock() external view returns (uint256);
}

interface ICOMPERC20 is IERC20 {}

interface IComptroller {
    function claimComp(address, ICERC20[] memory) external;

    function compRate() external view returns (uint256);
}

interface IUniswapV2Router02 {
    function getAmountsOut(uint256, address[] memory)
        external
        view
        returns (uint256[] memory);

    function swapExactTokensForTokens(
        uint256,
        uint256,
        address[] calldata,
        address,
        uint256
    ) external returns (uint256[] memory);
}

interface IDAOVault {
    function totalSupply() external view returns (uint256);

    function balanceOf(address _address) external view returns (uint256);
}

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
    uint256 private _amountOutMinPerc = 95;
    bool public isVesting = false;
    uint256 public pool;

    // Address to collect fees
    address public treasuryWallet = 0x59E83877bD248cBFe392dbB5A8a29959bcb48592;
    address public communityWallet = 0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0;

    // Calculation for fees
    // Represent [tier2 minimun, tier2 maximun], initial value represent Tier 2 from 10001 to 100000
    uint256[] public depositFeeTier2 = [10000e6 + 1, 100000e6];
    uint256 public constant DENOMINATOR = 10000;
    // Represent [Tier 1, Tier 2, Tier 3], initial value represent [1%, 0.5%, 0.25%]
    uint256[] public depositFee = [100, 50, 25];
    uint256 public profileSharingFee = 1000; // 10%
    // 50% split to treasury and community on profile sharing fee
    uint256 public constant treasuryAndCommunityFee = 5000;

    event SetTreasuryWallet(
        address indexed oldTreasuryWallet,
        address indexed newTreasuryWallet
    );
    event SetCommunityWallet(
        address indexed oldCommunityWallet,
        address indexed newCommunityWallet
    );
    event SetDepositFeeTier2(
        uint256[] oldDepositFeeTier2,
        uint256[] newDepositFeeTier2
    );
    event SetDepositFee(uint256[] oldDepositFee, uint256[] newDepositFee);
    event SetProfileSharingFee(
        uint256 indexed oldProfileSharingFee,
        uint256 indexed newProfileSharingFee
    );

    constructor(
        address _token,
        address _cToken,
        address _compToken,
        address _comptroller,
        address _uniswapRouter,
        address _WETH
    ) ERC20("Compound-Farmer USDT", "cfUSDT") {
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
        require(_amount > 0, "No balance to deposit");

        uint256 error = cToken.mint(_amount);
        require(error == 0, "Failed to lend into Compound");
    }

    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        emit SetTreasuryWallet(treasuryWallet, _treasuryWallet);
        treasuryWallet = _treasuryWallet;
    }

    function setCommunityWallet(address _communityWallet) external onlyOwner {
        emit SetCommunityWallet(communityWallet, _communityWallet);
        communityWallet = _communityWallet;
    }

    function setDepositFeeTier2(uint256[] calldata _depositFeeTier2)
        external
        onlyOwner
    {
        require(_depositFeeTier2[0] != 0, "Minimun amount cannot be 0");
        require(
            _depositFeeTier2[1] > _depositFeeTier2[0],
            "Maximun amount must greater than minimun amount"
        );

        emit SetDepositFeeTier2(depositFeeTier2, _depositFeeTier2);
        depositFeeTier2 = _depositFeeTier2;
    }

    function setDepositFee(uint256[] calldata _depositFee) external onlyOwner {
        require(
            _depositFee[0] < 4000 &&
                _depositFee[1] < 4000 &&
                _depositFee[2] < 4000,
            "Deposit fee percentage cannot be more than 40%"
        );
        emit SetDepositFee(depositFee, _depositFee);
        depositFee = _depositFee;
    }

    function setProfileSharingFee(uint256 _percentage) public onlyOwner {
        require(
            _percentage < 4000,
            "Profile sharing fee percentage cannot be more than 40%"
        );
        emit SetProfileSharingFee(profileSharingFee, _percentage);
        profileSharingFee = _percentage;
    }

    function setAmountOutMinPerc(uint256 _percentage) external onlyOwner {
        _amountOutMinPerc = _percentage;
    }

    function getBalance(address _address) external view returns (uint256) {
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

        uint256 _depositFee;
        if (_amount < depositFeeTier2[0]) {
            // Tier 1
            _depositFee = depositFee[0];
        } else if (
            _amount >= depositFeeTier2[0] && _amount <= depositFeeTier2[1]
        ) {
            // Tier 2
            _depositFee = depositFee[1];
        } else {
            // Tier 3
            _depositFee = depositFee[2];
        }

        uint256 _fee = _amount.mul(_depositFee).div(DENOMINATOR);
        _amount = _amount.sub(_fee);
        uint256 error = cToken.mint(_amount);
        require(error == 0, "Failed to lend into Compound");
        token.safeTransfer(treasuryWallet, _fee);

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
        require(
            DAOVault.balanceOf(tx.origin) >= _shares,
            "Insufficient balance"
        );

        ICERC20[] memory _cTokens = new ICERC20[](1);
        _cTokens[0] = cToken;
        comptroller.claimComp(address(this), _cTokens);

        uint256 _cTokenBalance =
            cToken.balanceOf(address(this)).mul(_amount).div(pool);
        uint256 error = cToken.redeem(_cTokenBalance);
        require(error == 0, "Failed to redeem from Compound");

        if (compToken.balanceOf(address(this)) > 0) {
            uint256 _amountIn =
                compToken.balanceOf(address(this)).mul(_amount).div(pool);
            compToken.safeApprove(address(uniswapRouter), _amountIn);

            address[] memory _path = new address[](3);
            _path[0] = address(compToken);
            _path[1] = WETH;
            _path[2] = address(token);

            uint256[] memory _amountsOut =
                uniswapRouter.getAmountsOut(_amountIn, _path);
            if (_amountsOut[2] > 0) {
                uint256 _amountOutMin =
                    _amountsOut[2].mul(_amountOutMinPerc).div(100);
                uniswapRouter.swapExactTokensForTokens(
                    _amountIn,
                    _amountOutMin,
                    _path,
                    address(this),
                    block.timestamp
                );
            }
        }

        uint256 _r = token.balanceOf(address(this));
        if (_r > _amount) {
            uint256 _p = _r.sub(_amount);
            uint256 _fee = _p.mul(profileSharingFee).div(DENOMINATOR);
            token.safeTransfer(tx.origin, _r.sub(_fee));
            token.safeTransfer(
                treasuryWallet,
                _fee.mul(treasuryAndCommunityFee).div(DENOMINATOR)
            );
            token.safeTransfer(
                communityWallet,
                _fee.mul(treasuryAndCommunityFee).div(DENOMINATOR)
            );
        } else {
            token.safeTransfer(tx.origin, _r);
        }

        pool = pool.sub(_amount);
        _burn(address(DAOVault), _shares);
    }

    function vesting() external onlyOwner {
        require(isVesting == false, "Already in vesting state");

        // Withdraw all funds from Compound
        isVesting = true;
        uint256 _all = cToken.balanceOfUnderlying(address(this));
        if (_all > 0) {
            uint256 error = cToken.redeemUnderlying(_all);
            require(error == 0, "Failed to redeem from Compound");
        }
        // if (compToken.balanceOf(address(this)) > 0) {
        //   _swapTokenWithCOMP();
        // }
        // Collect all fees
        uint256 _r = token.balanceOf(address(this));
        if (_r > _all) {
            uint256 _p = _r.sub(_all);
            uint256 _fee = _p.mul(profileSharingFee).div(DENOMINATOR);
            token.safeTransfer(
                treasuryWallet,
                _fee.mul(treasuryAndCommunityFee).div(DENOMINATOR)
            );
            token.safeTransfer(
                communityWallet,
                _fee.mul(treasuryAndCommunityFee).div(DENOMINATOR)
            );
        }
        pool = token.balanceOf(address(this));
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
