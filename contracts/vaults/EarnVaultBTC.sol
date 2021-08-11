// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../../libs/BaseRelayRecipient.sol";
import "hardhat/console.sol";

interface IStrategy {
    function getTotalPool() external view returns (uint256);
    function invest(uint256 _amount) external;
    function yield() external;
    function withdraw(uint256 _amount) external returns (uint256);
    function emergencyWithdraw() external;
    function reinvest() external;
    function setCommunityWallet(address _communityWallet) external;
    function setAdmin(address _admin) external;
    function setStrategist(address _strategist) external;
    function setCurveZap(address _curveZap) external;
    function setYieldFeePerc(uint256 _percentage) external;
}

interface ICurveZap {
    function getVirtualPrice() external view returns (uint256);
    function setStrategy(address _strategy) external;
    function swapFees(uint256 _fees) external returns (uint256, address);
}

interface IDAOmine {
    function depositByProxy(address _user, uint256 _pid, uint256 _amount) external;
}

contract EarnVaultBTC is Initializable, ERC20Upgradeable, OwnableUpgradeable,
        ReentrancyGuardUpgradeable, PausableUpgradeable, BaseRelayRecipient {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public lpToken;
    uint256 public percKeepInVault;
    IStrategy public strategy;
    ICurveZap public curveZap;
    address public admin;
    uint256 private constant _DENOMINATOR = 10000;

    // DAOmine
    IDAOmine public daoMine;
    uint256 public daoMinePid;

    // Calculation for fees
    uint256[] public networkFeeTier2;
    uint256 public customNetworkFeeTier;
    uint256[] public networkFeePerc;
    uint256 public customNetworkFeePerc;
    uint256 private _fees;

    // Address to collect fees
    address public treasuryWallet;
    address public communityWallet;
    address public strategist;

    // For smart contract interaction
    mapping(address => uint256) public depositTime;

    // For change new strategy
    address public pendingStrategy;
    bool public canSetPendingStrategy;
    uint256 public unlockTime;
    uint256 public constant LOCKTIME = 2 days;

    event Deposit(address indexed caller, uint256 amtDeposit, uint256 sharesMint);
    event Withdraw(address indexed caller, uint256 amtWithdraw, uint256 sharesBurn);
    event Invest(uint256 amtToInvest);
    event RetrievetokenFromStrategy(uint256 _amount);
    event TransferredOutFees(uint256 fees);
    event UnlockChangeStrategy(uint256 unlockTime);
    event ChangeStrategy(address indexed fromStrategy, address indexed toStrategy);
    event SetPendingStrategy(address indexed pendingStrategy);
    event SetCurveZap(address indexed _curveZap);
    event SetNetworkFeeTier2(uint256[] oldNetworkFeeTier2, uint256[] newNetworkFeeTier2);
    event SetCustomNetworkFeeTier(uint256 indexed oldCustomNetworkFeeTier, uint256 indexed newCustomNetworkFeeTier);
    event SetNetworkFeePerc(uint256[] oldNetworkFeePerc, uint256[] newNetworkFeePerc);
    event SetCustomNetworkFeePerc(uint256 indexed oldCustomNetworkFeePerc, uint256 indexed newCustomNetworkFeePerc);
    event SetYieldFeePerc(uint256 indexed percentage);
    event SetPercTokenKeepInVault(uint256 indexed percentages);
    event SetTreasuryWallet(address indexed treasuryWallet);
    event SetCommunityWallet(address indexed communityWallet);
    event SetAdminWallet(address indexed admin);
    event SetStrategistWallet(address indexed strategistWallet);
    event SetBiconomy(address indexed biconomy);
    event SetDaoMine(address indexed daoMine, uint256 indexed daoMinePid);

    modifier onlyOwnerOrAdmin {
        require(msg.sender == owner() || msg.sender == address(admin), "Only owner or admin");
        _;
    }

    /// @notice Initialize this vault contract
    /// @notice This function can only be execute once (by vault factory contract)
    /// @param _lpToken Address of Curve pool LP token
    /// @param _strategy Address of Earn strategy contract
    /// @param _curveZap Address of CurveZap contract
    /// @param _treasuryWallet Address of treasury wallet
    /// @param _communityWallet Address of community wallet
    /// @param _admin Address of admin
    /// @param _strategist Address of strategist
    /// @param _biconomy Address of Biconomy contract
    function initialize(
        address _lpToken, address _strategy, address _curveZap,
        address _treasuryWallet, address _communityWallet,
        address _admin, address _strategist, address _biconomy
    ) external initializer {
        __ERC20_init("DAO Earn", "daoERN");
        __Ownable_init();

        networkFeeTier2 = [50000*1e18+1, 100000*1e18];
        customNetworkFeeTier = 1000000*1e18;
        networkFeePerc = [100, 75, 50];
        customNetworkFeePerc = 25;

        lpToken = IERC20Upgradeable(_lpToken);
        percKeepInVault = 500;
        strategy = IStrategy(_strategy);
        curveZap = ICurveZap(_curveZap);
        treasuryWallet = _treasuryWallet;
        communityWallet = _communityWallet;
        admin = _admin;
        strategist = _strategist;
        trustedForwarder = _biconomy;
        canSetPendingStrategy = true;

        lpToken.safeApprove(_strategy, type(uint256).max);
        lpToken.safeApprove(_curveZap, type(uint256).max);
    }

    /// @notice Function that required for inherit BaseRelayRecipient
    function _msgSender() internal override(ContextUpgradeable, BaseRelayRecipient) view returns (address) {
        return BaseRelayRecipient._msgSender();
    }
    
    /// @notice Function that required for inherit BaseRelayRecipient
    function versionRecipient() external pure override returns (string memory) {
        return "1";
    }

    /// @notice Function to deposit token
    /// @param _amount Amount to deposit (18 decimals)
    /// @param _stake True if stake into DAOmine
    /// @return _daoERNBal Amount of minted shares
    function deposit(uint256 _amount, bool _stake) external nonReentrant whenNotPaused returns (uint256 _daoERNBal) {
        require(_amount > 0, "Amount must > 0");
        if (msg.sender != tx.origin && !isTrustedForwarder(msg.sender)) {
            // Smart contract interaction: to prevent deposit & withdraw at same transaction
            depositTime[msg.sender] = block.timestamp;
        }

        address _sender = _msgSender();
        uint256 _pool = _getAllPool();
        lpToken.safeTransferFrom(_sender, address(this), _amount);
        _daoERNBal = _deposit(_amount, _sender, _stake, _pool);
    }

    /// @notice Function to deposit token through CurveZap contract
    /// @param _amount Amount to deposit (18 decimals)
    /// @param _account Account to deposit (user address)
    /// @param _stake True if stake into DAOmine
    /// @return _daoERNBal Amount of minted shares
    function depositZap(uint256 _amount, address _account, bool _stake) external nonReentrant whenNotPaused returns (uint256 _daoERNBal) {
        require(msg.sender == address(curveZap), "Only CurveZap");
        uint256 _pool = _getAllPool();
        lpToken.safeTransferFrom(address(curveZap), address(this), _amount);
        _daoERNBal = _deposit(_amount, _account, _stake, _pool);
    }

    /// @notice Derived function from deposit()
    /// @param _amount Amount to deposit (18 decimals)
    /// @param _account Account to deposit (user address)
    /// @param _stake True if stake into DAOmine
    /// @param _pool All pool before deposit
    /// @return Amount of minted shares
    function _deposit(uint256 _amount, address _account, bool _stake, uint256 _pool) private returns (uint256) {
        uint256 _amtDeposit = _amount; // For event purpose

        // Calculate network fee
        uint256 _networkFeePerc;
        if (_amount < networkFeeTier2[0]) _networkFeePerc = networkFeePerc[0]; // Tier 1
        else if (_amount <= networkFeeTier2[1]) _networkFeePerc = networkFeePerc[1]; // Tier 2
        else if (_amount < customNetworkFeeTier) _networkFeePerc = networkFeePerc[2]; // Tier 3
        else _networkFeePerc = customNetworkFeePerc; // Custom Tier
        uint256 _fee = _amount * _networkFeePerc / _DENOMINATOR;
        _fees = _fees + _fee;
        _amount = _amount - _fee;

        uint256 _totalSupply = totalSupply();
        uint256 _shares = _totalSupply == 0 ? _amount : _amount * _totalSupply / _pool;
        if (_stake) {
            _mint(address(this), _shares);
            daoMine.depositByProxy(_account, daoMinePid, _shares);
        } else {
            _mint(_account, _shares);
        }
        emit Deposit(_account, _amtDeposit, _shares);

        return _shares;
    }

    /// @notice Function to withdraw token
    /// @param _shares Amount of shares to withdraw (18 decimals)
    /// @return _withdrawAmt Amount of token been withdrawn
    function withdraw(uint256 _shares) external nonReentrant returns (uint256 _withdrawAmt) {
        if (msg.sender != tx.origin) {
            // Smart contract interaction: to prevent deposit & withdraw at same transaction
            require(depositTime[msg.sender] + 300 < block.timestamp, "Withdraw within locked period");
        }
        _withdrawAmt = _withdraw(_shares, msg.sender);
    }

    /// @notice Function to withdraw token through CurveZap contract
    /// @param _shares Amount of shares to withdraw (18 decimals)
    /// @param _account Account to withdraw (user address)
    /// @return _withdrawAmt Amount of token to withdraw (18 decimals)
    function withdrawZap(uint256 _shares, address _account) external returns (uint256 _withdrawAmt) {
        require(msg.sender == address(curveZap), "Only CurveZap");
        _withdrawAmt = _withdraw(_shares, _account);
    }

    /// @notice Derived function from withdraw()
    /// @param _shares Amount of shares to withdraw (18 decimals)
    /// @param _account Account to withdraw (user address)
    /// @return Amount of token to withdraw (18 decimals)
    function _withdraw(uint256 _shares, address _account) private returns (uint256) {
        require(_shares > 0, "Shares must > 0");
        require(_shares <= balanceOf(_account), "Not enough shares to withdraw");
        
        // Calculate withdraw amount
        uint256 _withdrawAmt = _getAllPool() * _shares / totalSupply(); // 18 decimals
        _burn(_account, _shares);
        if (_withdrawAmt > lpToken.balanceOf(address(this))) {
            // Not enough token in vault, need to get from strategy
            _withdrawAmt = strategy.withdraw(_withdrawAmt);
        }

        lpToken.safeTransfer(msg.sender, _withdrawAmt);
        emit Withdraw(_account, _withdrawAmt, _shares);
        return _withdrawAmt;
    }

    /// @notice Function to invest funds into strategy
    function invest() public onlyOwnerOrAdmin whenNotPaused {
        // Transfer out available fees
        transferOutFees();

        // Calculation for keep portion of token and transfer balance of token to strategy
        uint256 _lpTokenBalance = lpToken.balanceOf(address(this));
        uint256 _toKeepAmt = _getAllPool() * percKeepInVault / _DENOMINATOR;
        if (_lpTokenBalance > _toKeepAmt) {
            uint256 _amtToInvest = _lpTokenBalance - _toKeepAmt;
            strategy.invest(_amtToInvest);
            emit Invest(_amtToInvest);
        }
    }

    /// @notice Function to yield farms rewards in strategy
    function yield() external onlyOwnerOrAdmin {
        strategy.yield();
    }

    /// @notice Function to retrieve token from strategy
    /// @param _amount Amount of token to retrieve (18 decimals)
    function retrievetokenFromStrategy(uint256 _amount) external onlyOwnerOrAdmin {
        strategy.withdraw(_amount);
        emit RetrievetokenFromStrategy(_amount);
    }

    /// @notice Function to withdraw all token from strategy and pause deposit & invest function
    function emergencyWithdraw() external onlyOwnerOrAdmin {
        _pause();
        strategy.emergencyWithdraw();
    }

    /// @notice Function to reinvest funds into strategy
    function reinvest() external onlyOwnerOrAdmin whenPaused {
        _unpause();
        invest();
    }

    /// @notice Function to transfer out available network fees
    function transferOutFees() public {
        require(
            msg.sender == address(this) ||
            msg.sender == owner() ||
            msg.sender == admin, "Only authorized caller");
        if (_fees != 0) {
            if (lpToken.balanceOf(address(this)) > _fees) {
                (uint256 _amount, address _tokenAddr) = curveZap.swapFees(_fees);
                IERC20Upgradeable _token = IERC20Upgradeable(_tokenAddr);
                uint256 _fee = _amount * 2 / 5; // (40%)
                _token.safeTransfer(treasuryWallet, _fee); // 40%
                _token.safeTransfer(communityWallet, _fee); // 40%
                _token.safeTransfer(strategist, _amount - _fee - _fee); // 20%
                emit TransferredOutFees(_fees); // Decimal follow _token
                _fees = 0;
            }
        }
    }

    /// @notice Function to unlock changeStrategy()
    function unlockChangeStrategy() external onlyOwner {
        unlockTime = block.timestamp + LOCKTIME;
        canSetPendingStrategy = false;
        emit UnlockChangeStrategy(unlockTime);
    }

    /// @notice Function to invest funds into new strategy contract
    /// @notice This function only last for 1 days after success unlocked
    /// @notice After change strategy, need to manually call reinvest() to invest funds into new strategy
    function changeStrategy() external onlyOwner whenPaused {
        require(unlockTime <= block.timestamp && unlockTime + 1 days >= block.timestamp, "Function locked");
        require(pendingStrategy != address(0), "No pendingStrategy");

        // Set new strategy
        address oldStrategy = address(strategy);
        strategy = IStrategy(pendingStrategy);
        curveZap.setStrategy(pendingStrategy);
        pendingStrategy = address(0);
        canSetPendingStrategy = true;

        // Approve new strategy
        lpToken.safeApprove(address(strategy), type(uint256).max);

        unlockTime = 0; // Lock back this function
        emit ChangeStrategy(oldStrategy, address(strategy));
    }

    /// @notice Function to set pending strategy address
    /// @param _pendingStrategy Address of pending strategy
    function setPendingStrategy(address _pendingStrategy) external onlyOwner {
        require(canSetPendingStrategy, "Cannot set pending strategy now");
        pendingStrategy = _pendingStrategy;
    }

    /// @notice Function to set new CurveZap contract
    /// @param _curveZap Address of new CurveZap contract
    function setCurveZap(address _curveZap) external onlyOwner {
        if (address(curveZap) != address(0)) {
            // Stop transfer token to old CurveZap contract
            lpToken.safeApprove(address(curveZap), 0);
        }
        curveZap = ICurveZap(_curveZap);
        lpToken.safeApprove(_curveZap, type(uint256).max);

        strategy.setCurveZap(_curveZap);
        emit SetCurveZap(_curveZap);
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
        uint256[] memory oldNetworkFeeTier2 = networkFeeTier2; // For event purpose
        networkFeeTier2 = _networkFeeTier2;
        emit SetNetworkFeeTier2(oldNetworkFeeTier2, _networkFeeTier2);
    }

    /// @notice Function to set new custom network fee tier
    /// @param _customNetworkFeeTier Amount of new custom network fee tier (18 decimals)
    function setCustomNetworkFeeTier(uint256 _customNetworkFeeTier) external onlyOwner {
        require(_customNetworkFeeTier > networkFeeTier2[1], "Must greater than tier 2");
        uint256 oldCustomNetworkFeeTier = customNetworkFeeTier; // For event purpose
        customNetworkFeeTier = _customNetworkFeeTier;
        emit SetCustomNetworkFeeTier(oldCustomNetworkFeeTier, _customNetworkFeeTier);
    }

    /// @notice Function to set new network fee percentage
    /// @param _networkFeePerc Array that contains new network fee percentage for tier 1, tier 2 and tier 3
    function setNetworkFeePerc(uint256[] calldata _networkFeePerc) external onlyOwner {
        require(_networkFeePerc[0] < 3001 && _networkFeePerc[1] < 3001 && _networkFeePerc[2] < 3001,
            "Not allow more than 30%");
        /**
         * _networkFeePerc content a array of 3 element, representing network fee of tier 1, tier 2 and tier 3
         * For example networkFeePerc is [100, 75, 50],
         * which mean network fee for Tier 1 = 1%, Tier 2 = 0.75% and Tier 3 = 0.5% (_DENOMINATOR = 10000)
         */
        uint256[] memory oldNetworkFeePerc = networkFeePerc; // For event purpose
        networkFeePerc = _networkFeePerc;
        emit SetNetworkFeePerc(oldNetworkFeePerc, _networkFeePerc);
    }

    /// @notice Function to set new custom network fee percentage
    /// @param _percentage Percentage of new custom network fee
    function setCustomNetworkFeePerc(uint256 _percentage) public onlyOwner {
        require(_percentage < networkFeePerc[2], "Not allow more than tier 2");
        uint256 oldCustomNetworkFeePerc = customNetworkFeePerc; // For event purpose
        customNetworkFeePerc = _percentage;
        emit SetCustomNetworkFeePerc(oldCustomNetworkFeePerc, _percentage);
    }
    
    /// @notice Function to set new yield fee percentage
    /// @param _percentage Percentage of new yield fee
    function setYieldFeePerc(uint256 _percentage) external onlyOwner {
        require(_percentage < 3001, "Not allow more than 30%");
        strategy.setYieldFeePerc(_percentage);
        emit SetYieldFeePerc(_percentage);
    }

    /// @notice Function to set new percentage of token that keep in vault
    /// @param _percentages New percentages of token that keep in vault
    function setPercTokenKeepInVault(uint256 _percentages) external onlyOwnerOrAdmin {
        percKeepInVault = _percentages;
        emit SetPercTokenKeepInVault(_percentages);
    }

    /// @notice Function to set new treasury wallet address
    /// @param _treasuryWallet Address of new treasury wallet
    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        treasuryWallet = _treasuryWallet;
        emit SetTreasuryWallet(_treasuryWallet);
    }

    /// @notice Function to set new community wallet address
    /// @param _communityWallet Address of new community wallet
    function setCommunityWallet(address _communityWallet) external onlyOwner {
        communityWallet = _communityWallet;
        strategy.setCommunityWallet(_communityWallet);
        emit SetCommunityWallet(_communityWallet);
    }

    /// @notice Function to set new admin address
    /// @param _admin Address of new admin
    function setAdmin(address _admin) external onlyOwner {
        admin = _admin;
        strategy.setAdmin(_admin);
        emit SetAdminWallet(_admin);
    }

    /// @notice Function to set new strategist address
    /// @param _strategist Address of new strategist
    function setStrategist(address _strategist) external {
        require(msg.sender == strategist || msg.sender == owner(), "Only owner or strategist");
        strategist = _strategist;
        strategy.setStrategist(_strategist);
        emit SetStrategistWallet(_strategist);
    }

    /// @notice Function to set new trusted forwarder address (Biconomy)
    /// @param _biconomy Address of new trusted forwarder
    function setBiconomy(address _biconomy) external onlyOwner {
        trustedForwarder = _biconomy;
        emit SetBiconomy(_biconomy);
    }

    /// @notice Function to set DAOmine and pid of this vault
    /// @param _daoMine Address of DAOmine
    /// @param _daoMinePid Pid of this vault in DAOmine
    function setDAOmine(address _daoMine, uint256 _daoMinePid) external onlyOwner {
        daoMine = IDAOmine(_daoMine);
        daoMinePid = _daoMinePid;
        emit SetDaoMine(_daoMine, _daoMinePid);
    }

    /// @notice Function to get total amount of token(vault+strategy)
    /// @return Total amount of token (18 decimals)
    function _getAllPool() private view returns (uint256) {
        uint256 _vaultPool = lpToken.balanceOf(address(this)) - _fees;
        uint256 _strategyPool = paused() ? 0 : strategy.getTotalPool();
        return _vaultPool + _strategyPool;
    }

    /// @notice Function to get all pool amount(vault+strategy) in BTC
    /// @return All pool in BTC (8 decimals)
    function getAllPoolInBTC() external view returns (uint256) {
        return _getAllPool() * curveZap.getVirtualPrice() / 1e28;
    }

    /// @notice Function to get price per full share (LP token price)
    /// @param _btc true for calculate user share in BTC, false for calculate APR
    /// @return Price per full share (8 decimals if _btc = true, otherwise 18 decimals)
    function getPricePerFullShare(bool _btc) external view returns (uint256) {
        uint256 _pricePerFullShare = _getAllPool() * 1e18 / totalSupply();
        return _btc == true ? _pricePerFullShare * curveZap.getVirtualPrice() / 1e28 : _pricePerFullShare;
    }

    /// @notice Function to get current available amount of token to invest
    /// @return Current available amount of token to invest
    function getAmtToInvest() external view returns (uint256) {
        uint256 _amtToKeep = _getAllPool() * percKeepInVault / _DENOMINATOR;
        return _getAllPool() - _amtToKeep;
    }
}