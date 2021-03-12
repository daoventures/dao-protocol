// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IYearn.sol";
import "../interfaces/IYvault.sol";
import "../interfaces/IDaoVault.sol";

/// @title Contract for yield token in Yearn Finance contracts
/// @dev This contract should not be reused after vesting state
contract YearnFarmerUSDTv2 is ERC20, Ownable {
  /**
   * @dev Inherit from Ownable contract enable contract ownership transferable
   * Function: transferOwnership(newOwnerAddress)
   * Only current owner is able to call the function
   */

  using SafeERC20 for IERC20;
  using Address for address;
  using SafeMath for uint256;

  IERC20 public  token;
  IYearn public  earn;
  IYvault public  vault;
  uint256 private constant MAX_UNIT = 2**256 - 2;
  mapping (address => uint256) private earnDepositBalance;
  mapping (address => uint256) private vaultDepositBalance;
  uint256 public pool;

  // Address to collect fees
  address public treasuryWallet = 0x59E83877bD248cBFe392dbB5A8a29959bcb48592;
  address public communityWallet = 0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0;

  uint256[] public networkFeeTier2 = [50000e6+1, 100000e6]; // Represent [tier2 minimun, tier2 maximun], initial value represent Tier 2 from 50001 to 100000
  uint256 public customNetworkFeeTier = 1000000e6;

  uint256 public constant DENOMINATOR = 10000;
  uint256[] public networkFeePercentage = [100, 75, 50]; // Represent [Tier 1, Tier 2, Tier 3], initial value represent [1%, 0.75%, 0.5%]
  uint256 public customNetworkFeePercentage = 25;
  uint256 public profileSharingFeePercentage = 1000;
  uint256 public constant treasuryFee = 5000; // 50% on profile sharing fee
  uint256 public constant communityFee = 5000; // 50% on profile sharing fee

  bool public isVesting = false;
  IDaoVault public daoVault;

  event SetTreasuryWallet(address indexed oldTreasuryWallet, address indexed newTreasuryWallet);
  event SetCommunityWallet(address indexed oldCommunityWallet, address indexed newCommunityWallet);
  event SetNetworkFeeTier2(uint256[] oldNetworkFeeTier2, uint256[] newNetworkFeeTier2);
  event SetNetworkFeePercentage(uint256[] oldNetworkFeePercentage, uint256[] newNetworkFeePercentage);
  event SetCustomNetworkFeeTier(uint256 oldCustomNetworkFeeTier, uint256 newCustomNetworkFeeTier);
  event SetCustomNetworkFeePercentage(uint256 oldCustomNetworkFeePercentage, uint256 newCustomNetworkFeePercentage);
  event SetProfileSharingFeePercentage(uint256 indexed oldProfileSharingFeePercentage, uint256 indexed newProfileSharingFeePercentage);

  constructor(address _token, address _earn, address _vault)
    ERC20("Yearn Farmer v2 USDT", "yfUSDTv2") {
      _setupDecimals(6);
      
      token = IERC20(_token);
      earn = IYearn(_earn);
      vault = IYvault(_vault);

      _approvePooling();
  }

  /**
   * @notice Set Vault that interact with this contract
   * @dev This function call after deploy Vault contract and only able to call once
   * @dev This function is needed only if this is the first strategy to connect with Vault
   * @param _address Address of Vault
   * Requirements:
   * - Only owner of this contract can call this function
   * - Vault is not set yet
   */
  function setVault(address _address) external onlyOwner {
    require(address(daoVault) == address(0), "Vault set");

    daoVault = IDaoVault(_address);
  }

  /**
   * @notice Set new treasury wallet address in contract
   * @param _treasuryWallet Address of new treasury wallet
   * Requirements:
   * - Only owner of this contract can call this function
   */
  function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
    address oldTreasuryWallet = treasuryWallet;
    treasuryWallet = _treasuryWallet;
    emit SetTreasuryWallet(oldTreasuryWallet, _treasuryWallet);
  }

  /**
   * @notice Set new community wallet address in contract
   * @param _communityWallet Address of new community wallet
   * Requirements:
   * - Only owner of this contract can call this function
   */
  function setCommunityWallet(address _communityWallet) external onlyOwner {
    address oldCommunityWallet = communityWallet;
    communityWallet = _communityWallet;
    emit SetCommunityWallet(oldCommunityWallet, _communityWallet);
  }

  /**
   * @notice Set network fee tier
   * @notice Details for network fee tier can view at deposit() function below
   * @param _networkFeeTier2  Array [tier2 minimun, tier2 maximun], view additional info below
   * Requirements:
   * - Only owner of this contract can call this function
   * - First element in array must greater than 0
   * - Second element must greater than first element
   */
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

  /**
   * @notice Set network fee in percentage
   * @param _networkFeePercentage An array of integer, view additional info below
   * Requirements:
   * - Only owner of this contract can call this function
   * - Each of the element in the array must less than 4000 (40%) 
   */
  function setNetworkFeePercentage(uint256[] calldata _networkFeePercentage) external onlyOwner {
    /** 
     * _networkFeePercentage content a array of 3 element, representing network fee of tier 1, tier 2 and tier 3
     * For example networkFeePercentage is [100, 75, 50]
     * which mean network fee for Tier 1 = 1%, Tier 2 = 0.75% and Tier 3 = 0.5%
     */
    require(
      _networkFeePercentage[0] < 4000 &&
      _networkFeePercentage[1] < 4000 &&
      _networkFeePercentage[2] < 4000, "Network fee percentage cannot be more than 40%"
    );

    uint256[] memory oldNetworkFeePercentage = networkFeePercentage;
    networkFeePercentage = _networkFeePercentage;
    emit SetNetworkFeePercentage(oldNetworkFeePercentage, _networkFeePercentage);
  }

  /**
   * @notice Set network fee tier
   * @param _customNetworkFeeTier Integar
   * @dev Custom network fee tier is checked before network fee tier 3. Please check networkFeeTier[1] before set.
   * Requirements:
   * - Only owner of this contract can call this function
   * - Custom network fee tier must greater than network fee tier 2
   */
  function setCustomNetworkFeeTier(uint256 _customNetworkFeeTier) external onlyOwner {
    require(_customNetworkFeeTier > networkFeeTier2[1], "Custom network fee tier must greater than tier 2");

    uint256 oldCustomNetworkFeeTier = customNetworkFeeTier;
    customNetworkFeeTier = _customNetworkFeeTier;
    emit SetCustomNetworkFeeTier(oldCustomNetworkFeeTier, _customNetworkFeeTier);
  }

  /**
   * @notice Set custom network fee
   * @param _percentage Integar (100 = 1%)
   * Requirements:
   * - Only owner of this contract can call this function
   * - Amount set must less than network fee for tier 2
   */
  function setCustomNetworkFeePercentage(uint256 _percentage) public onlyOwner {
    require(_percentage < networkFeePercentage[2], "Custom network fee percentage cannot be more than tier 2");

    uint256 oldCustomNetworkFeePercentage = customNetworkFeePercentage;
    customNetworkFeePercentage = _percentage;
    emit SetCustomNetworkFeePercentage(oldCustomNetworkFeePercentage, _percentage);
  }

  /**
   * @notice Set profile sharing fee
   * @param _percentage Integar (100 = 1%)
   * Requirements:
   * - Only owner of this contract can call this function
   * - Amount set must less than 4000 (40%)
   */
  function setProfileSharingFeePercentage(uint256 _percentage) public onlyOwner {
    require(_percentage < 4000, "Profile sharing fee percentage cannot be more than 40%");

    uint256 oldProfileSharingFeePercentage = profileSharingFeePercentage;
    profileSharingFeePercentage = _percentage;
    emit SetProfileSharingFeePercentage(oldProfileSharingFeePercentage, _percentage);
  }

  /**
   * @notice Approve Yearn Finance contracts to deposit token from this contract
   * @dev This function only need execute once in contract contructor
   */
  function _approvePooling() private {
    uint256 earnAllowance = token.allowance(address(this), address(earn));
    if (earnAllowance == uint256(0)) {
      token.safeApprove(address(earn), MAX_UNIT);
    }
    uint256 vaultAllowance = token.allowance(address(this), address(vault));
    if (vaultAllowance == uint256(0)) {
      token.safeApprove(address(vault), MAX_UNIT);
    }
  }

  /**
   * @notice Get Yearn Earn current total deposit amount of account (after network fee)
   * @param _address Address of account to check
   * @return Current total deposit amount of account in Yearn Earn. 0 if contract is in vesting state.
   */
  function getEarnDepositBalance(address _address) external view returns (uint256) {
    if (isVesting == true) {
      return 0;
    } else {
      return earnDepositBalance[_address];
    }
  }

  /**
   * @notice Get Yearn Vault current total deposit amount of account (after network fee)
   * @param _address Address of account to check
   * @return Current total deposit amount of account in Yearn Vault. 0 if contract is in vesting state.
   */
  function getVaultDepositBalance(address _address) external view returns (uint256) {
    if (isVesting == true) {
      return 0;
    } else {
      return vaultDepositBalance[_address];
    }
  }

  /**
   * @notice Deposit token into Yearn Earn and Vault contracts
   * @param _amounts amount of earn and vault to deposit in list: [earn deposit amount, vault deposit amount]
   * Requirements:
   * - Sender must approve this contract to transfer token from sender to this contract
   * - This contract is not in vesting state
   * - Only Vault can call this function
   * - Either first element(earn deposit) or second element(earn deposit) in list must greater than 0
   */
  function deposit(uint256[] memory _amounts) public {
    require(isVesting == false, "Contract in vesting state");
    require(msg.sender == address(daoVault), "Only can call from Vault");
    require(_amounts[0] > 0 || _amounts[1] > 0, "Amount must > 0");
    
    uint256 _earnAmount = _amounts[0];
    uint256 _vaultAmount = _amounts[1];
    uint256 _depositAmount = _earnAmount.add(_vaultAmount);
    token.safeTransferFrom(tx.origin, address(this), _depositAmount);

    uint256 _earnNetworkFee = 0;
    uint256 _vaultNetworkFee = 0;
    uint256 _networkFeePercentage = 0;
    /**
     * Network fees
     * networkFeeTier2 is used to set each tier minimun and maximun
     * For example networkFeeTier2 is [50000, 100000],
     * Tier 1 = _depositAmount < 50001
     * Tier 2 = 50001 <= _depositAmount <= 100000
     * Tier 3 = _depositAmount > 100000
     *
     * networkFeePercentage is used to set each tier network fee percentage
     * For example networkFeePercentage is [100, 75, 50]
     * which mean network fee for Tier 1 = 1%, Tier 2 = 0.75%, Tier 3 = 0.5%
     *
     * customNetworkFeeTier is set before network fee tier 3
     * customNetworkFeepercentage will be used if _depositAmount over customNetworkFeeTier before network fee tier 3
     */
    if (_depositAmount < networkFeeTier2[0]) {
      // Tier 1
      _networkFeePercentage = networkFeePercentage[0];
    } else if (_depositAmount >= networkFeeTier2[0] && _depositAmount <= networkFeeTier2[1]) {
      // Tier 2
      _networkFeePercentage = networkFeePercentage[1];
    } else if (_depositAmount >= customNetworkFeeTier) {
      // Custom tier
      _networkFeePercentage = customNetworkFeePercentage;
    } else {
      // Tier 3
      _networkFeePercentage = networkFeePercentage[2];
    }

    // Deposit to Yearn Earn after fee
    if (_earnAmount > 0) {
      _earnNetworkFee = _earnAmount.mul(_networkFeePercentage).div(DENOMINATOR);
      _earnAmount = _earnAmount.sub(_earnNetworkFee);
      earn.deposit(_earnAmount);
      earnDepositBalance[tx.origin] = earnDepositBalance[tx.origin].add(_earnAmount);
    }

    // Deposit to Yearn Vault after fee
    if (_vaultAmount > 0) {
      _vaultNetworkFee = _vaultAmount.mul(_networkFeePercentage).div(DENOMINATOR);
      _vaultAmount = _vaultAmount.sub(_vaultNetworkFee);
      vault.deposit(_vaultAmount);
      vaultDepositBalance[tx.origin] = vaultDepositBalance[tx.origin].add(_vaultAmount);
    }
    token.safeTransfer(treasuryWallet, _earnNetworkFee.add(_vaultNetworkFee));

    uint256 _shares = 0;
    if (totalSupply() == 0) {
      _shares = _earnAmount.add(_vaultAmount);
    } else {
      _shares = (_earnAmount.add(_vaultAmount)).mul(totalSupply()).div(pool);
    }
    _mint(address(daoVault), _shares);
    pool = pool.add(_earnAmount.add(_vaultAmount));
  }

  /**
   * @notice Withdraw from Yearn Earn and Vault contracts
   * @param _shares amount of earn and vault to withdraw in list: [earn withdraw amount, vault withdraw amount]
   * Requirements:
   * - This contract is not in vesting state
   * - Only Vault can call this function
   */
  function withdraw(uint256[] memory _shares) external {
    require(isVesting == false, "Contract in vesting state");
    require(msg.sender == address(daoVault), "Only can call from Vault");

    if (_shares[0] > 0) {
      _withdrawEarn(_shares[0]);
    }

    if (_shares[1] > 0) {
      _withdrawVault(_shares[1]);
    }
  }

  /**
   * @notice Withdraw from Yearn Earn contract
   * @dev Only call within function withdraw()
   * @param _shares Amount of shares to withdraw
   * Requirements:
   * - Amount input must less than or equal to sender current total amount of earn deposit in contract
   */
  function _withdrawEarn(uint256 _shares) private {
    uint256 _d = pool.mul(_shares).div(totalSupply()); // Initial Deposit Amount
    require(earnDepositBalance[tx.origin] >= _d, "Insufficient balance");
    uint256 _earnShares = (_d.mul(earn.totalSupply())).div(earn.calcPoolValueInToken()); // Find earn shares based on deposit amount 
    uint256 _r = ((earn.calcPoolValueInToken()).mul(_earnShares)).div(earn.totalSupply()); // Actual earn withdraw amount

    earn.withdraw(_earnShares);
    earnDepositBalance[tx.origin] = earnDepositBalance[tx.origin].sub(_d);
    
    _burn(address(daoVault), _shares);
    pool = pool.sub(_d);

    if (_r > _d) {
      uint256 _p = _r.sub(_d); // Profit
      uint256 _fee = _p.mul(profileSharingFeePercentage).div(DENOMINATOR);
      token.safeTransfer(tx.origin, _r.sub(_fee));
      token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
      token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
    } else {
      token.safeTransfer(tx.origin, _r);
    }
  }

  /**
   * @notice Withdraw from Yearn Vault contract
   * @dev Only call within function withdraw()
   * @param _shares Amount of shares to withdraw
   * Requirements:
   * - Amount input must less than or equal to sender current total amount of vault deposit in contract
   */
  function _withdrawVault(uint256 _shares) private {
    uint256 _d = pool.mul(_shares).div(totalSupply()); // Initial Deposit Amount
    require(vaultDepositBalance[tx.origin] >= _d, "Insufficient balance");
    uint256 _vaultShares = (_d.mul(vault.totalSupply())).div(vault.balance()); // Find vault shares based on deposit amount 
    uint256 _r = ((vault.balance()).mul(_vaultShares)).div(vault.totalSupply()); // Actual vault withdraw amount

    vault.withdraw(_vaultShares);
    vaultDepositBalance[tx.origin] = vaultDepositBalance[tx.origin].sub(_d);

    _burn(address(daoVault), _shares);
    pool = pool.sub(_d);

    if (_r > _d) {
      uint256 _p = _r.sub(_d); // Profit
      uint256 _fee = _p.mul(profileSharingFeePercentage).div(DENOMINATOR);
      token.safeTransfer(tx.origin, _r.sub(_fee));
      token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
      token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
    } else {
      token.safeTransfer(tx.origin, _r);
    }
  }

  /**
   * @notice Vesting this contract, withdraw all the token from Yearn contracts
   * @notice Disabled the deposit and withdraw functions for public, only allowed users to do refund from this contract
   * Requirements:
   * - Only owner of this contract can call this function
   * - This contract is not in vesting state
   */
  function vesting() external onlyOwner {
    require(isVesting == false, "Already in vesting state");

    // Withdraw all funds from Yearn Earn and Vault contracts
    isVesting = true;
    uint256 _earnBalance = earn.balanceOf(address(this));
    uint256 _vaultBalance = vault.balanceOf(address(this));
    if (_earnBalance > 0) {
      earn.withdraw(_earnBalance);
    }
    if (_vaultBalance > 0) {
      vault.withdraw(_vaultBalance);
    }

    // Collect all profits
    if (token.balanceOf(address(this)) > pool) {
      uint256 _profit = token.balanceOf(address(this)).sub(pool);
      uint256 _fee = _profit.mul(profileSharingFeePercentage).div(DENOMINATOR);
      token.safeTransfer(treasuryWallet, _fee.mul(treasuryFee).div(DENOMINATOR));
      token.safeTransfer(communityWallet, _fee.mul(communityFee).div(DENOMINATOR));
    }
    pool = 0;
  }

  /**
   * @notice Get token amount based on daoToken hold by account after contract in vesting state
   * @param _address Address of account to check
   * @return Token amount based on on daoToken hold by account. 0 if contract is not in vesting state
   */
  function getSharesValue(address _address) external view returns (uint256) {
    if (isVesting == false) {
      return 0;
    } else {
      uint256 _shares = daoVault.balanceOf(_address);
      if (_shares > 0) {
        return token.balanceOf(address(this)).mul(_shares).div(daoVault.totalSupply());
      } else {
        return 0;
      }
    }
  }

  /**
   * @notice Refund all tokens based on daoToken hold by sender
   * @notice Only available after contract in vesting state
   * Requirements:
   * - This contract is in vesting state
   * - Only Vault can call this function
   */
  function refund(uint256 _shares) external {
    require(isVesting == true, "Not in vesting state");
    require(msg.sender == address(daoVault), "Only can call from Vault");

    uint256 _refundAmount = token.balanceOf(address(this)).mul(_shares).div(daoVault.totalSupply());
    token.safeTransfer(tx.origin, _refundAmount);
    _burn(address(daoVault), _shares);
  }

  /**
   * @notice Approve Vault to migrate funds from this contract
   * @notice Only available after contract in vesting state
   * Requirements:
   * - Only owner of this contract can call this function
   * - This contract is in vesting state
   */
  function approveMigrate() external onlyOwner {
    require(isVesting == true, "Not in vesting state");

    if (token.allowance(address(this), address(daoVault)) == 0) {
      token.safeApprove(address(daoVault), MAX_UNIT);
    }
  }
}