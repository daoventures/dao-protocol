const { expect } = require("chai")
const { ethers, deployments, waffle, network } = require("hardhat")
const { mainnet: network_ } = require("../../addresses/harvest_farmer")
const IERC20_ABI = require("../../abis/IERC20_ABI.json")
const sampleContract_JSON = require("../../build/harvest_farmer/SampleContract.json")

const { FARMAddress, uniswapRouterAddress, WETHAddress, treasuryWalletAddress, communityWalletAddress } = network_.GLOBAL
const { tokenAddress, hfVaultAddress, hfStakeAddress } = network_.USDC
const tokenDecimals = 6 // Change this to meet token decimals
const created_index = 1 // USDC

const { BigNumber } = require('bignumber.js');
BigNumber.config({
  EXPONENTIAL_AT: 1e+9,
  ROUNDING_MODE: BigNumber.ROUND_FLOOR,
})

const global = require('../utils/global');
const { increaseTime, UInt256Max } = require('../utils/ethereum');

const decimals = (amount) => {
  return ethers.utils.parseUnits(amount.toString(), tokenDecimals)
}

/*-----------------------------------------------------------------------------------------------------------*/
// We have to consider the maximum 0.0001% (10 ^ -6) delta because deposit/withdraw amount issue in hfVault
//
// hfVault.deposit(90000000);
// hfVault.withdraw(hfVault.balanceOf(address(this))); // 89999999 is returned
//
// As above example, it has 0.000001 USDC deltas for withdrawal.
/*-----------------------------------------------------------------------------------------------------------*/
const closeTo = (value, expected) => {
  const expectedAmount = new BigNumber(typeof expected === "object" ? expected.toString() : expected);
  const valueAmount = new BigNumber(typeof value === "object" ? value.toString() : value);
  const deltaAmount = expectedAmount.shiftedBy(-tokenDecimals);
  const isEqual = expectedAmount.minus(valueAmount).abs().isLessThanOrEqualTo(deltaAmount);
  if (!isEqual) {
    console.log(`|${expectedAmount} - ${valueAmount}| > ${deltaAmount}`)
  }
  expect(isEqual).is.true;
}

describe("Harvest-Farmer USDC", () => {

  const setup = async () => {
    const [deployerSigner, clientSigner, adminSigner] = await ethers.getSigners()
    const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
    const FARMContract = new ethers.Contract(FARMAddress, IERC20_ABI, deployerSigner)

    const strategyFactoryContract = await ethers.getContract("HarvestFarmerFactory")
    const strategyAddress = await strategyFactoryContract.strategies(created_index)
    const strategyContract = await ethers.getContractAt("HarvestFarmer", strategyAddress)

    const vaultAddress = await strategyContract.daoVault()
    const vaultContract = await ethers.getContractAt("DAOVault", vaultAddress)

    const governanceSigner = await ethers.getSigner("0xf00dD244228F51547f0563e60bCa65a30FBF5f7f")
    const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [vaultAddress, tokenContract.address])

    const ABI = [
      "function balanceOf(address) external view returns (uint)",
      "function doHardWork() external",
    ]
    const hfVaultContract = new ethers.Contract(hfVaultAddress, ABI, governanceSigner)
    const hfStakeContract = new ethers.Contract(hfStakeAddress, ABI, governanceSigner)

    return { deployerSigner, clientSigner, governanceSigner, adminSigner,
      strategyContract, vaultContract,
      tokenContract, FARMContract, sampleContract, hfVaultContract, hfStakeContract
    }
  }

  beforeEach(async () => {
    await deployments.fixture(["hf_hardhat"])
  })

  it("should deploy contract correctly for Vault and Strategy contract", async () => {
    const { deployerSigner, strategyContract, vaultContract } = await setup()
    // Check if execute set vault function again to be reverted in vault contract
    await expect(strategyContract.setVault(deployerSigner.address)).to.be.revertedWith("Vault set")
    // Check if execute init function again to be reverted in both contract
    await expect(vaultContract.init(
      ethers.utils.formatBytes32String("DAOVault Medium-Risk USDC"),
      tokenAddress, strategyContract.address, deployerSigner.address)).to.be.revertedWith("Initializable: contract is already initialized")
    await expect(strategyContract.init(
      ethers.utils.formatBytes32String("Harvest-Farmer USDC"),
      tokenAddress, hfVaultAddress, hfStakeAddress, FARMAddress, uniswapRouterAddress, WETHAddress, deployerSigner.address))
      .to.be.revertedWith("Initializable: contract is already initialized")
    // Check if contract owner is contract deployer in both contracts
    expect(await strategyContract.owner()).to.equal(deployerSigner.address)
    expect(await vaultContract.owner()).to.equal(deployerSigner.address)
    // Check if token details are correct in vault contract
    expect(await vaultContract.name()).to.equal("DAO Vault Harvest")
    expect(await vaultContract.symbol()).to.equal("daoHAR")
    expect(await vaultContract.decimals()).to.equal(18)
    // Check if all pre-set addresses are correct in vault contract
    expect(await vaultContract.token()).to.equal(tokenAddress)
    expect(await vaultContract.strategy()).to.equal(strategyContract.address)
    expect(await vaultContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
    // Check if other pre-set variables are correct in vault contract
    expect(await vaultContract.vaultName()).to.equal(ethers.utils.formatBytes32String("DAOVault Medium-Risk USDC"))
    expect(await vaultContract.canSetPendingStrategy()).is.true
    expect(await vaultContract.unlockTime()).to.equal(0)
    // expect(await vaultContract.LOCKTIME()).to.equal(2*24*60*60)
    // Check if all pre-set fees are correct in vault contract
    expect(await vaultContract.networkFeeTier2(0)).to.equal(decimals(50000).add(1))
    expect(await vaultContract.networkFeeTier2(1)).to.equal(decimals(100000))
    expect(await vaultContract.customNetworkFeeTier()).to.equal(decimals(1000000))
    // expect(await vaultContract.DENOMINATOR()).to.equal("10000")
    expect(await vaultContract.networkFeePercentage(0)).to.equal("100")
    expect(await vaultContract.networkFeePercentage(1)).to.equal("75")
    expect(await vaultContract.networkFeePercentage(2)).to.equal("50")
    expect(await vaultContract.customNetworkFeePercentage()).to.equal("25")
    // expect(await vaultContract.treasuryFee()).to.equal("5000")
    // expect(await vaultContract.communityFee()).to.equal("5000")
    // Check if all pre-set addresses are correct in strategy contract
    expect(await strategyContract.token()).to.equal(tokenAddress)
    expect(await strategyContract.daoVault()).to.equal(vaultContract.address)
    expect(await strategyContract.hfVault()).to.equal(hfVaultAddress)
    expect(await strategyContract.hfStake()).to.equal(hfStakeAddress)
    expect(await strategyContract.FARM()).to.equal(FARMAddress)
    expect(await strategyContract.uniswapRouter()).to.equal(uniswapRouterAddress)
    expect(await strategyContract.WETH()).to.equal(WETHAddress)
    expect(await strategyContract.treasuryWallet()).to.equal(treasuryWalletAddress)
    expect(await strategyContract.communityWallet()).to.equal(communityWalletAddress)
    // Check if all pre-set fees are correct in strategy contract
    // expect(await strategyContract.DENOMINATOR()).to.equal("10000")
    expect(await strategyContract.profileSharingFeePercentage()).to.equal("1000")
    // expect(await strategyContract.treasuryFee()).to.equal("5000")
    // expect(await strategyContract.communityFee()).to.equal("5000")
    // Check if all other pre-set variables are correct in strategy contract
    expect(await strategyContract.strategyName()).to.equal(ethers.utils.formatBytes32String("Harvest-Farmer USDC"))
    expect(await strategyContract.isVesting()).is.false
    expect(await strategyContract.pool()).to.equal(0)
    expect(await strategyContract.amountOutMinPerc()).to.equal(0)
  })

  // Check admin functions
  describe("Admin functions", () => {
    it("revert to save gas if nothing deposited token", async () => {
      const { vaultContract } = await setup()
      await expect(vaultContract.invest()).to.be.revertedWith("revert No balance of the deposited token")
    });

    it("should be called the invest by only admin", async () => {
      const { deployerSigner, clientSigner, tokenContract, strategyContract, vaultContract, adminSigner } = await setup()
      await tokenContract.transfer(clientSigner.address, decimals("1000"))
      // Deposit into contract
      await tokenContract.connect(clientSigner).approve(vaultContract.address, decimals("1000"))
      await vaultContract.connect(clientSigner).deposit(decimals("1000"))
      await vaultContract.invest()

      expect(await vaultContract.admin()).to.equal(deployerSigner.address)
      await vaultContract.setAdmin(adminSigner.address);
      expect(await vaultContract.admin()).to.equal(adminSigner.address)

      await expect(vaultContract.invest()).to.be.revertedWith("revert Only admin")
      await vaultContract.connect(adminSigner).invest()
    })
  });

  // Check user functions
  describe("User functions", () => {
    it("should able to deposit correctly", async () => {
      // Get deployer signer and deploy the contracts
      const { clientSigner, tokenContract, strategyContract, vaultContract, sampleContract, hfVaultContract, hfStakeContract } = await setup()
      // Check if meet the function requirements
      let depositAmount = decimals(100)
      await tokenContract.transfer(clientSigner.address, depositAmount)
      await tokenContract.transfer(sampleContract.address, depositAmount)
      await tokenContract.connect(clientSigner).approve(vaultContract.address, depositAmount)
      await expect(vaultContract.connect(clientSigner).deposit("0")).to.be.revertedWith("Amount must > 0")
      // await expect(strategyContract.connect(clientSigner).deposit("100")).to.be.revertedWith("Only can call from Vault")
      await sampleContract.approve(vaultContract.address, depositAmount)
      await expect(sampleContract.deposit(depositAmount)).to.be.revertedWith("Only EOA")

      // Deposit token into contracts
      await vaultContract.connect(clientSigner).deposit(depositAmount)
      expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
      const depositedAmount = depositAmount.mul(99).div(100); // deposit fee 1%
      closeTo(await vaultContract.balanceOf(clientSigner.address), depositedAmount)

      // Check if amount of deposit is correct
      await vaultContract.invest();
      closeTo(await strategyContract.getCurrentBalance(clientSigner.address), depositedAmount)

      // Check if amount of shares token get is correct
      depositAmount = depositAmount.mul(99).div(100)
      const shares = depositAmount.mul(await vaultContract.totalSupply()).div(await strategyContract.pool())
      closeTo(await vaultContract.balanceOf(clientSigner.address), shares)
      closeTo(await strategyContract.pool(), depositAmount)
      closeTo(await vaultContract.totalSupply(), shares)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.gt(0)
    })

    it("should deduct correct network fee based on tier in strategy contract", async () => {
      const { deployerSigner, tokenContract, vaultContract, strategyContract } = await setup()
      let treasuryBalance, communityBalance, depositBalance, fee
      treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
      communityBalance = await tokenContract.balanceOf(communityWalletAddress)
      const depositTier1 = decimals(10000)
      const depositTier2 = decimals(100000)
      const depositTier3 = decimals(500000)
      const customDepositTier = decimals(1000000)
      await tokenContract.approve(vaultContract.address, depositTier1.add(depositTier2).add(depositTier3).add(customDepositTier))

      // Tier 1 deposit
      await vaultContract.deposit(depositTier1)
      await vaultContract.invest();
      // Check deposit balance in contract and check fees receive by treasury and community wallet
      fee = depositTier1.mul(100).div(10000)
      closeTo(await strategyContract.getCurrentBalance(deployerSigner.address), depositTier1.sub(fee))
      depositBalance = depositTier1.sub(fee)
      // We used closeTo instead of equal. This is because there is an error in hardhat node. For example
      // For example, the balance is 50000000 in the smart contract, but 50000001 is returned by web3.
      expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.closeTo(treasuryBalance.add(fee.div(2)), 1);
      treasuryBalance = treasuryBalance.add(fee.div(2))
      expect(await tokenContract.balanceOf(communityWalletAddress)).to.closeTo(communityBalance.add(fee.div(2)), 1); // Because there is an error in hardhat node
      communityBalance = communityBalance.add(fee.div(2))

      // Tier 2 deposit
      await vaultContract.deposit(depositTier2)
      await vaultContract.invest();
      // Check deposit balance in contract and check fees receive by treasury and community wallet
      fee = depositTier2.mul(75).div(10000)
      closeTo(await strategyContract.getCurrentBalance(deployerSigner.address), depositBalance.add(depositTier2.sub(fee)))
      depositBalance = depositBalance.add(depositTier2.sub(fee))
      closeTo(await tokenContract.balanceOf(treasuryWalletAddress), treasuryBalance.add(fee.mul(1).div(2)))
      treasuryBalance = treasuryBalance.add(fee.mul(1).div(2))
      closeTo(await tokenContract.balanceOf(communityWalletAddress), communityBalance.add(fee.mul(1).div(2)))
      communityBalance = communityBalance.add(fee.mul(1).div(2))

      // Tier 3 deposit
      await vaultContract.deposit(depositTier3)
      await vaultContract.invest();
      // Check deposit balance in contract and check fees receive by treasury and community wallet
      fee = depositTier3.mul(50).div(10000)
      closeTo(await strategyContract.getCurrentBalance(deployerSigner.address), depositBalance.add(depositTier3.sub(fee)))
      depositBalance = depositBalance.add(depositTier3.sub(fee))
      closeTo(await tokenContract.balanceOf(treasuryWalletAddress), treasuryBalance.add(fee.mul(1).div(2)))
      treasuryBalance = treasuryBalance.add(fee.mul(1).div(2))
      closeTo(await tokenContract.balanceOf(communityWalletAddress), communityBalance.add(fee.mul(1).div(2)))
      communityBalance = communityBalance.add(fee.mul(1).div(2))

      // Custom tier deposit
      await vaultContract.deposit(customDepositTier)
      await vaultContract.invest();
      // Check deposit balance in contract and check fees receive by treasury and community wallet
      fee = customDepositTier.mul(25).div(10000)
      closeTo(await strategyContract.getCurrentBalance(deployerSigner.address), depositBalance.add(customDepositTier.sub(fee)))
      closeTo(await tokenContract.balanceOf(treasuryWalletAddress), treasuryBalance.add(fee.mul(1).div(2)))
      closeTo(await tokenContract.balanceOf(communityWalletAddress), communityBalance.add(fee.mul(1).div(2)))
    })

    it("should be able to withdraw correctly", async () => {
      // Get deployer signer and deploy the contracts
      const { clientSigner, tokenContract, FARMContract, strategyContract, vaultContract, hfVaultContract, hfStakeContract, sampleContract } = await setup()

      // If there is no deposited token, the withdrawal will be reverted.
      await expect(vaultContract.withdraw(decimals(200))).to.be.revertedWith("revert SafeMath: division by zero")

      // Deposit token into contracts
      const depositAmount = decimals(1000)
      expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
      await tokenContract.transfer(clientSigner.address, depositAmount)
      await tokenContract.connect(clientSigner).approve(vaultContract.address, depositAmount)
      await vaultContract.connect(clientSigner).deposit(depositAmount)
      await vaultContract.invest();
      const currentBalance = await strategyContract.getCurrentBalance(clientSigner.address)
      // // Execute Harvest Finance earn function
      // await hfVaultContract.doHardWork()

      // Check if meet the function requirements
      await expect(sampleContract.withdraw(decimals(100))).to.be.revertedWith("Only EOA")
      await expect(vaultContract.connect(clientSigner).withdraw("0")).to.be.revertedWith("Amount must > 0")
      await expect(strategyContract.connect(clientSigner).withdraw(decimals(200))).to.be.revertedWith("Only can call from Vault")
      await expect(vaultContract.withdraw(decimals(200))).to.be.revertedWith("revert ERC20: burn amount exceeds balance")

      // Withdraw all token from contracts
      await vaultContract.connect(clientSigner).withdraw(await vaultContract.balanceOf(clientSigner.address))

      // Check if amount of withdraw is correct
      closeTo(await tokenContract.balanceOf(clientSigner.address), currentBalance)
      expect(await vaultContract.balanceOf(clientSigner.address)).to.equal(0)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await FARMContract.balanceOf(strategyContract.address)).to.equal(0)
    })

    it("should be able to withdraw in several times correctly", async() => {
      // Get deployer and client signer and deploy the contracts
      const { clientSigner, tokenContract, FARMContract, strategyContract, vaultContract, hfStakeContract, hfVaultContract } = await setup()
      // Deposit token into contracts
      const depositAmount = decimals("1000")
      expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
      await tokenContract.transfer(clientSigner.address, depositAmount)
      await tokenContract.connect(clientSigner).approve(vaultContract.address, depositAmount)
      await vaultContract.connect(clientSigner).deposit(depositAmount)
      await vaultContract.invest();

      // Execute Harvest Finance earn function
      await hfVaultContract.doHardWork()
      // Get initial value before withdraw
      const depositBalanceBoforeWithdraw = await strategyContract.getCurrentBalance(clientSigner.address)
      const dvlTokenBalanceBeforeWithdraw = await vaultContract.balanceOf(clientSigner.address)
      const fTokenBalanceBeforeWithdraw = await hfStakeContract.balanceOf(strategyContract.address)
      const totalSupplyBeforeWithdraw = await vaultContract.totalSupply()
      const poolBalanceBeforeWithdraw = await strategyContract.pool()

      // Withdraw token from contracts 1st time
      let withdrawShare = decimals("373")
      await vaultContract.connect(clientSigner).withdraw(withdrawShare)
      const withdrawnAmount = await tokenContract.balanceOf(clientSigner.address);

      // Check if amount of withdraw is correct
      expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(withdrawShare)
      closeTo(await vaultContract.balanceOf(clientSigner.address),
        dvlTokenBalanceBeforeWithdraw.sub(withdrawShare.mul(totalSupplyBeforeWithdraw).div(poolBalanceBeforeWithdraw)))
      closeTo(await hfStakeContract.balanceOf(strategyContract.address),
        fTokenBalanceBeforeWithdraw.sub(fTokenBalanceBeforeWithdraw.mul(withdrawShare).div(poolBalanceBeforeWithdraw)))
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await FARMContract.balanceOf(strategyContract.address)).to.be.equal(0)
      closeTo(await strategyContract.getCurrentBalance(clientSigner.address), depositBalanceBoforeWithdraw.sub(withdrawnAmount))
      expect(poolBalanceBeforeWithdraw - await strategyContract.pool()).to.lte(withdrawnAmount)
      expect(await vaultContract.totalSupply()).to.equal(totalSupplyBeforeWithdraw.sub(withdrawShare))

      // Withdraw token from contracts 2nd time
      withdrawShare = await vaultContract.balanceOf(clientSigner.address)
      await vaultContract.connect(clientSigner).withdraw(withdrawShare)

      // Check if amount of withdraw is correct
      expect(await tokenContract.balanceOf(clientSigner.address)).to.gt(depositBalanceBoforeWithdraw)
      expect(await vaultContract.balanceOf(clientSigner.address)).to.equal(0)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await FARMContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await strategyContract.getCurrentBalance(clientSigner.address)).to.equal(0)
      expect(await strategyContract.pool()).to.equal(0)
      expect(await vaultContract.totalSupply()).to.equal(0)
    })

    // it("should deduct correct profile sharing fee when withdraw in strategy contract", async () => {
    //   const { clientSigner, tokenContract, strategyContract, vaultContract, hfVaultContract } = await setup()
    //   const treasuryWalletBalance = await tokenContract.balanceOf(treasuryWalletAddress)
    //   const communityWalletBalance = await tokenContract.balanceOf(communityWalletAddress)
    //   await tokenContract.transfer(clientSigner.address, decimals("1000"))
    //   // Deposit into contract
    //   await tokenContract.connect(clientSigner).approve(vaultContract.address, decimals("1000"))
    //   await vaultContract.connect(clientSigner).deposit(decimals("1000"))
    //   await vaultContract.invest()
    //   const networkFee = decimals("1000").mul(1).div(100)
    //   const deployerBalance = await tokenContract.balanceOf(clientSigner.address)

    //   // // Execute Harvest Finance earn function
    //   // await hfVaultContract.doHardWork()
    //   // Transfer some token to contract as profit
    //   await tokenContract.transfer(strategyContract.address, decimals("100")) // It's not treated as profit in the invest function.
    //   const profileSharingFee = decimals("100").mul(1).div(10)
    //   const profit = decimals("100").sub(profileSharingFee)
    //   await vaultContract.invest()

    //   // Withdraw from contract and check if fee deduct correctly
    //   await vaultContract.connect(clientSigner).withdraw(decimals("990"))
    //   expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(deployerBalance.add(decimals("990")).add(profit), decimals(1))
    //   expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.be.closeTo(treasuryWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), decimals(1))
    //   expect(await tokenContract.balanceOf(communityWalletAddress)).to.be.closeTo(communityWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), decimals(1))
    // })

    it("should be able to mix and match deposit and withdraw correctly", async () => {
      const { deployerSigner, clientSigner, tokenContract, strategyContract, vaultContract, hfVaultContract, hfStakeContract, FARMContract } = await setup()
      // Transfer some token to client
      await tokenContract.transfer(clientSigner.address, decimals("10000"))
      // Get data before deposit
      const deployerBalance = await tokenContract.balanceOf(deployerSigner.address)
      const clientBalance = await tokenContract.balanceOf(clientSigner.address)
      const treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
      const communityBalance = await tokenContract.balanceOf(communityWalletAddress)

      // Mix and match deposit and withdraw
      await tokenContract.approve(vaultContract.address, decimals("10000"))
      await tokenContract.connect(clientSigner).approve(vaultContract.address, decimals("10000"))
      await vaultContract.deposit(decimals("1234"))
      await vaultContract.connect(clientSigner).deposit(decimals("3210"))
      await vaultContract.deposit(decimals("2345"))
      await vaultContract.invest()

      // Execute Harvest Finance earn function
      await hfVaultContract.doHardWork()

      // Continue mix and match deposit and withdraw
      await vaultContract.connect(clientSigner).withdraw(decimals("2020"))
      await vaultContract.withdraw(decimals("1989"))
      await vaultContract.connect(clientSigner).deposit(decimals("378"))
      await vaultContract.invest()
      await vaultContract.connect(clientSigner).withdraw(await vaultContract.balanceOf(clientSigner.address))
      await vaultContract.withdraw(await vaultContract.balanceOf(deployerSigner.address))

      // Check if final number is correct
      expect(await strategyContract.pool()).to.equal(0)
      expect(await strategyContract.getCurrentBalance(deployerSigner.address)).to.equal(0)
      expect(await strategyContract.getCurrentBalance(clientSigner.address)).to.equal(0)
      expect(await vaultContract.totalSupply()).to.equal(0)
      expect(await vaultContract.balanceOf(deployerSigner.address)).to.equal(0)
      expect(await vaultContract.balanceOf(clientSigner.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await FARMContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await tokenContract.balanceOf(deployerSigner.address)).to.gt(deployerBalance.sub("35790000"))
      expect(await tokenContract.balanceOf(clientSigner.address)).to.gt(clientBalance.sub("35880000"))
      // Check if treasury and community wallet receive fees correctly
      expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryBalance.add("35835000"))
      expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityBalance.add("35835000"))
    })

    it("should be able to refund correctly when contract is in vesting state", async () => {
      const { deployerSigner, clientSigner , tokenContract, hfVaultContract, hfStakeContract, FARMContract, strategyContract, vaultContract } = await setup()
      // Deposit into contract and check if all parameter is correct
      const depositAmount = decimals("1000")
      await tokenContract.approve(vaultContract.address, depositAmount)
      await vaultContract.deposit(depositAmount)
      await tokenContract.transfer(clientSigner.address, depositAmount)
      await tokenContract.connect(clientSigner).approve(vaultContract.address, depositAmount)
      await vaultContract.connect(clientSigner).deposit(depositAmount)
      await vaultContract.invest();

      const depositBalance = await strategyContract.getCurrentBalance(deployerSigner.address)
      const treasuryBalanceBeforeVesting = await tokenContract.balanceOf(treasuryWalletAddress)
      const communityBalanceBeforeVesting = await tokenContract.balanceOf(communityWalletAddress)
      expect(await vaultContract.balanceOf(deployerSigner.address)).to.equal(decimals(990))
      expect(await vaultContract.balanceOf(clientSigner.address)).to.equal(decimals(990))
      expect(await vaultContract.totalSupply()).to.equal(decimals(1980))
      closeTo(await strategyContract.pool(), decimals(1980));
      expect(await tokenContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.gt(0)
      expect(await FARMContract.balanceOf(strategyContract.address)).to.equal(0)
      // // Execute Harvest Finance earn function
      // await hfVaultContract.doHardWork()
      // Vesting the contract
      await strategyContract.vesting()
      expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryBalanceBeforeVesting)
      expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityBalanceBeforeVesting)
      const refundBalance = await strategyContract.getCurrentBalance(deployerSigner.address)
      expect(refundBalance).to.gte(depositBalance)
      expect(await strategyContract.pool()).to.gt(decimals(1980))
      expect(await tokenContract.balanceOf(strategyContract.address)).to.gt(decimals(1980))
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await FARMContract.balanceOf(strategyContract.address)).to.equal(0)
      // Refund from vesting contract
      await expect(strategyContract.connect(clientSigner).refund(decimals(100))).to.be.revertedWith("Only can call from Vault")
      await expect(strategyContract.refund(decimals(100))).to.be.revertedWith("Only can call from Vault")
      await vaultContract.connect(clientSigner).refund()
      await vaultContract.refund()
      expect(await tokenContract.balanceOf(deployerSigner.address)).to.gte(depositBalance.mul(1).div(100))
      expect(await vaultContract.balanceOf(deployerSigner.address)).to.equal(0)
      expect(await vaultContract.totalSupply()).to.equal(0)
      expect(await strategyContract.pool()).to.equal(0)
      expect(await tokenContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await FARMContract.balanceOf(strategyContract.address)).to.equal(0)
    })

    it("should deduct correct profile sharing fee when vesting in strategy contract", async () => {
      const { clientSigner, tokenContract, strategyContract, vaultContract, hfVaultContract } = await setup()
      const treasuryWalletBalance = await tokenContract.balanceOf(treasuryWalletAddress)
      const communityWalletBalance = await tokenContract.balanceOf(communityWalletAddress)
      await tokenContract.transfer(clientSigner.address, decimals(1000))
      // Deposit into contract
      await tokenContract.connect(clientSigner).approve(vaultContract.address, decimals(1000))
      await vaultContract.connect(clientSigner).deposit(decimals(500))
      await vaultContract.invest();
      await vaultContract.connect(clientSigner).deposit(decimals(500))
      const deployerBalance = await tokenContract.balanceOf(clientSigner.address)
      // // Execute Harvest Finance earn function
      // await hfVaultContract.doHardWork()
      // Transfer some token to contract as profit
      await tokenContract.transfer(strategyContract.address, decimals(100))
      const profileSharingFee = decimals(100).mul(1).div(10)
      const profit = decimals(100).sub(profileSharingFee)
      const networkFee = decimals(500).mul(1).div(100) // 500 USDC not invested to strategy yet. fee is 1%
      // Vesting contract and check if fee deduct correctly
      await strategyContract.vesting()
      await vaultContract.connect(clientSigner).refund()
      expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(deployerBalance.add(decimals(990)).add(profit), decimals(1))
      expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.be.closeTo(treasuryWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), decimals(1))
      expect(await tokenContract.balanceOf(communityWalletAddress)).to.be.closeTo(communityWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), decimals(1))
    })
  })

  // Test admin functions
  describe("Admin functions", () => {
    it("should able to transfer contract ownership to other address by contract owner only in Vault and Strategy factory contracts", async () => {
      const { deployerSigner, clientSigner, strategyContract } = await setup()
      // Get factory contracts and check if initial variable state is correct
      const vaultFactoryContract = await ethers.getContract("DAOVaultFactory")
      const vaultTemplateContract = await ethers.getContract("DAOVault")
      const strategyFactoryContract = await ethers.getContract("HarvestFarmerFactory")
      const strategyTemplateContract = await ethers.getContract("HarvestFarmer")
      expect(await vaultFactoryContract.vaultTemplate()).to.equal(vaultTemplateContract.address)
      expect(await strategyFactoryContract.strategyTemplate()).to.equal(strategyTemplateContract.address)
      // Check if contract ownership is owner before transfer
      expect(await vaultFactoryContract.owner()).to.equal(deployerSigner.address)
      expect(await strategyFactoryContract.owner()).to.equal(deployerSigner.address)
      // Check if new owner cannot execute clone contract functions yet
      await expect(vaultFactoryContract.connect(clientSigner).createVault(ethers.utils.formatBytes32String("DAOVault Medium-Risk USDC"),
        tokenAddress, strategyContract.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyFactoryContract.connect(clientSigner).createStrategy(ethers.utils.formatBytes32String("Harvest-Farmer USDC"),
        tokenAddress, hfVaultAddress, hfStakeAddress, FARMAddress, uniswapRouterAddress, WETHAddress)).to.be.revertedWith("Ownable: caller is not the owner")
      // Transfer contract ownership from owner to new owner
      await vaultFactoryContract.transferOwnership(clientSigner.address)
      await strategyFactoryContract.transferOwnership(clientSigner.address)
      // Check if contract ownership is new owner after transfer
      expect(await vaultFactoryContract.owner()).to.equal(clientSigner.address)
      expect(await strategyFactoryContract.owner()).to.equal(clientSigner.address)
      // Check if new owner can execute admin function
      await expect(vaultFactoryContract.connect(clientSigner).createVault(ethers.utils.formatBytes32String("DAOVault Medium-Risk USDC"),
        tokenAddress, strategyContract.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyFactoryContract.connect(clientSigner).createStrategy(ethers.utils.formatBytes32String("Harvest-Farmer USDC"),
        tokenAddress, hfVaultAddress, hfStakeAddress, FARMAddress, uniswapRouterAddress, WETHAddress)).not.to.be.revertedWith("Ownable: caller is not the owner")
      // Check if original owner neither can execute admin function nor transfer back ownership
      await expect(vaultFactoryContract.transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyFactoryContract.transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultFactoryContract.createVault(ethers.utils.formatBytes32String("DAOVault Medium-Risk USDC"),
        tokenAddress, strategyContract.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyFactoryContract.createStrategy(ethers.utils.formatBytes32String("Harvest-Farmer USDC"),
        tokenAddress, hfVaultAddress, hfStakeAddress, FARMAddress, uniswapRouterAddress, WETHAddress)).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("should able to transfer contract ownership to other address by contract owner only in vault and strategy contracts", async () => {
      const { deployerSigner, clientSigner, strategyContract, vaultContract } = await setup()
      // Check if contract ownership is owner before transfer
      expect(await strategyContract.owner()).to.equal(deployerSigner.address)
      expect(await vaultContract.owner()).to.equal(deployerSigner.address)
      // Check if new owner cannot execute admin functions yet
      await expect(vaultContract.connect(clientSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setNetworkFeeTier2([decimals(100), decimals(200)])).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setCustomNetworkFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).setProfileSharingFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).setAmountOutMinPerc(9000)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).revertVesting()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).approveMigrate()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).reuseContract()).to.be.revertedWith("Ownable: caller is not the owner")
      // Transfer contract ownership from owner to new owner
      await vaultContract.connect(deployerSigner).transferOwnership(clientSigner.address)
      await strategyContract.connect(deployerSigner).transferOwnership(clientSigner.address)
      // Check if contract ownership is new owner after transfer
      expect(await vaultContract.owner()).to.equal(clientSigner.address)
      expect(await strategyContract.owner()).to.equal(clientSigner.address)
      // Check if new owner can execute admin function
      await expect(vaultContract.connect(clientSigner).unlockMigrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).migrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setNetworkFeeTier2([decimals(100), decimals(200)])).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(clientSigner).setCustomNetworkFeePercentage(3000)).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).setProfileSharingFeePercentage(3000)).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).setAmountOutMinPerc(9000)).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).vesting()).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).revertVesting()).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).approveMigrate()).not.to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(clientSigner).reuseContract()).not.to.be.revertedWith("Ownable: caller is not the owner")
      // Check if original owner neither can execute admin function nor transfer back ownership
      await expect(vaultContract.connect(deployerSigner).transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(deployerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(deployerSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(deployerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(deployerSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(deployerSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(deployerSigner).setNetworkFeeTier2([decimals(100), decimals(200)])).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(deployerSigner).setNetworkFeePercentage([3000, 3000, 3000])).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(deployerSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(vaultContract.connect(deployerSigner).setCustomNetworkFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(deployerSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(deployerSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(deployerSigner).setProfileSharingFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(deployerSigner).setAmountOutMinPerc(9000)).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(deployerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(deployerSigner).revertVesting()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(deployerSigner).approveMigrate()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(strategyContract.connect(deployerSigner).reuseContract()).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("should able to set new treasury wallet correctly in vault contract", async () => {
      const { clientSigner, tokenContract, vaultContract } = await setup()
      // Set new treasury wallet and check if event for setTreasuryWallet function is logged
      await expect(vaultContract.setTreasuryWallet(clientSigner.address))
          .to.emit(vaultContract, "SetTreasuryWallet")
          .withArgs(treasuryWalletAddress, clientSigner.address)
      // Check if new treasury wallet is set to the contract
      expect(await vaultContract.treasuryWallet()).to.equal(clientSigner.address)
      // Check if new treasury wallet receive fees
      await tokenContract.approve(vaultContract.address, decimals(200))
      await vaultContract.deposit(decimals(200))
      await vaultContract.invest();
      // Deposit amount within network fee tier 1 hence fee = 0.5%
      expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(decimals(1))
    })

    it("should able to set new community wallet correctly in vault contract", async () => {
      const { clientSigner, tokenContract, vaultContract } = await setup()
      // Set new community wallet and check if event for setCommunityWallet function is logged
      await expect(vaultContract.setCommunityWallet(clientSigner.address))
          .to.emit(vaultContract, "SetCommunityWallet")
          .withArgs(communityWalletAddress, clientSigner.address)
      // Check if new community wallet is set to the contract
      expect(await vaultContract.communityWallet()).to.equal(clientSigner.address)
      // Check if new treasury wallet receive fees
      await tokenContract.approve(vaultContract.address, decimals(200))
      await vaultContract.deposit(decimals(200))
      await vaultContract.invest();
      // Deposit amount within network fee tier 1 hence fee = 0.5%
      expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(decimals(1))
    })

    it("should able to set new treasury wallet correctly in strategy contract", async () => {
      const { clientSigner, tokenContract, strategyContract, vaultContract } = await setup()
      // Set new treasury wallet and check if event for setTreasuryWallet function is logged
      await expect(strategyContract.setTreasuryWallet(clientSigner.address))
          .to.emit(strategyContract, "SetTreasuryWallet")
          .withArgs(treasuryWalletAddress, clientSigner.address)
      // Check if new treasury wallet is set to the contract
      expect(await strategyContract.treasuryWallet()).to.equal(clientSigner.address)

      // // Check if new treasury wallet receive fees
      // await tokenContract.approve(vaultContract.address, decimals(200))
      // await vaultContract.deposit(decimals(200))
      // await vaultContract.invest();
      // await tokenContract.transfer(strategyContract.address, decimals(50)) // It's not treated as profit in the invest function.
      // await vaultContract.withdraw(decimals(198))
      // // Profile sharing fee = 10%
      // expect(await tokenContract.balanceOf(clientSigner.address)).to.gt(decimals(2))
    })

    it("should able to set new community wallet correctly in strategy contract", async () => {
      const { clientSigner, tokenContract, strategyContract, vaultContract } = await setup()
      // Set new community wallet and check if event for setCommunityWallet function is logged
      await expect(strategyContract.setCommunityWallet(clientSigner.address))
          .to.emit(strategyContract, "SetCommunityWallet")
          .withArgs(communityWalletAddress, clientSigner.address)
      // Check if new community wallet is set to the contract
      expect(await strategyContract.communityWallet()).to.equal(clientSigner.address)

      // // Check if new treasury wallet receive fees
      // await tokenContract.approve(vaultContract.address, decimals(200))
      // await vaultContract.deposit(decimals(200))
      // await vaultContract.invest();
      // await tokenContract.transfer(strategyContract.address, decimals(50))
      // await vaultContract.withdraw(decimals(198))
      // // Profile sharing fee = 10%
      // expect(await tokenContract.balanceOf(clientSigner.address)).to.gt(decimals(2))
    })

    it("should able to set new network fee tier correctly in vault contract", async () => {
      const { vaultContract } = await setup()
      // Check if function parameter meet the requirements
      await expect(vaultContract.setNetworkFeeTier2([0, decimals(10000)]))
          .to.be.revertedWith("Minimun amount cannot be 0")
      await expect(vaultContract.setNetworkFeeTier2([decimals(10000), decimals(10000)]))
          .to.be.revertedWith("Maximun amount must greater than minimun amount")
      // Set new network fee tier 2 and check if event for setNetworkFeeTier2 is logged
      await expect(vaultContract.setNetworkFeeTier2([decimals(60000).add(1), decimals(600000)]))
          .to.emit(vaultContract, "SetNetworkFeeTier2")
          .withArgs([(decimals(50000).add(1).toString()).toString(), decimals(100000).toString()], [(decimals(60000).add(1)).toString(), decimals(600000).toString()])
      // Check if network fee tier 2 amount is set correctly
      expect(await vaultContract.networkFeeTier2(0)).to.equal(decimals(60000).add(1))
      expect(await vaultContract.networkFeeTier2(1)).to.equal(decimals(600000))
    })

    it("should able to set new custom network fee tier correctly in vault contract", async () => {
      const { vaultContract } = await setup()
      // Check if function parameter meet the requirements
      await expect(vaultContract.setCustomNetworkFeeTier(decimals(10000)))
          .to.be.revertedWith("Custom network fee tier must greater than tier 2")
      // Set new custom network fee tier and check if event for setCustomNetworkFeeTier is logged
      await expect(vaultContract.setCustomNetworkFeeTier(decimals(2000000)))
          .to.emit(vaultContract, "SetCustomNetworkFeeTier")
          .withArgs(decimals(1000000).toString(), decimals(2000000).toString())
      // Check if custom network fee tier amount is set correctly
      expect(await vaultContract.customNetworkFeeTier()).to.equal(decimals(2000000))
    })

    it("should able to set new network fee percentage correctly in vault contract", async () => {
      const { vaultContract } = await setup()
      // Check if function parameter meet the requirements
      await expect(vaultContract.setNetworkFeePercentage([3000, 0, 0]))
          .to.be.revertedWith("Network fee percentage cannot be more than 30%")
      await expect(vaultContract.setNetworkFeePercentage([0, 3000, 0]))
          .to.be.revertedWith("Network fee percentage cannot be more than 30%")
      await expect(vaultContract.setNetworkFeePercentage([0, 0, 3000]))
          .to.be.revertedWith("Network fee percentage cannot be more than 30%")
      // Set network fee percentage and check if event for setNetworkFeePercentage is logged
      await expect(vaultContract.setNetworkFeePercentage([200, 100, 50]))
          .to.emit(vaultContract, "SetNetworkFeePercentage")
          .withArgs([100, 75, 50], [200, 100, 50])
      // Check if network fee percentage is set correctly
      expect(await vaultContract.networkFeePercentage(0)).to.equal(200)
      expect(await vaultContract.networkFeePercentage(1)).to.equal(100)
      expect(await vaultContract.networkFeePercentage(2)).to.equal(50)
    })

    it("should able to set new custom network fee percentage correctly in vault contract", async () => {
      const { vaultContract } = await setup()
      // Check if function parameter meet the requirements
      await expect(vaultContract.setCustomNetworkFeePercentage(60))
          .to.be.revertedWith("Custom network fee percentage cannot be more than tier 2")
      // Set custom network fee percentage and check if event for setCustomNetworkFeePercentage is logged
      await expect(vaultContract.setCustomNetworkFeePercentage(10))
          .to.emit(vaultContract, "SetCustomNetworkFeePercentage")
          .withArgs(25, 10)
      // Check if network fee percentage is set correctly
      expect(await vaultContract.customNetworkFeePercentage()).to.equal(10)
    })

    it("should able to set new profile sharing fee percentage correctly in strategy contract", async () => {
      const { strategyContract } = await setup()
      // Check if function parameter meet the requirements
      await expect(strategyContract.setProfileSharingFeePercentage(3000))
          .to.be.revertedWith("Profile sharing fee percentage cannot be more than 30%")
      // Set profile sharing fee percentage and check if event for setProfileSharingFeePercentage is logged
      await expect(strategyContract.setProfileSharingFeePercentage(2000))
          .to.emit(strategyContract, "SetProfileSharingFeePercentage")
          .withArgs(1000, 2000)
      // Check if profile sharing fee percentage is set correctly
      expect(await strategyContract.profileSharingFeePercentage()).to.equal(2000)
    })

    it("should set amount out minimum percentage on Uniswap swap function correctly in strategy contract", async () => {
      const { strategyContract } = await setup()
      // Check if meet the requirements
      await expect(strategyContract.setAmountOutMinPerc(9900)).to.be.revertedWith("Amount out minimun > 97%")
      // Set new amount out minimum percentage
      await strategyContract.setAmountOutMinPerc(8000)
      // Check if new amount out minimum percentage set correctly
      expect(await strategyContract.amountOutMinPerc()).to.equal(8000)
    })

    it("should able to set pending strategy, migrate funds and set new strategy correctly in vault contract", async () => {
      const { deployerSigner, tokenContract, strategyContract, vaultContract } = await setup()
      // Set pending strategy
      const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [vaultContract.address, tokenContract.address])
      await vaultContract.setPendingStrategy(sampleContract.address)
      // Check if pending strategy is set with given address
      expect(await vaultContract.pendingStrategy()).to.equal(sampleContract.address)
      // Deposit into Vault and execute vesting function
      await tokenContract.approve(vaultContract.address, decimals(100000))
      await vaultContract.deposit(decimals(100000))
      await vaultContract.invest();
      await strategyContract.vesting()
      // Get Yearn Farmer token balance before migrate
      const tokenBalance = await tokenContract.balanceOf(strategyContract.address)
      // Execute unlock migrate funds function
      await vaultContract.unlockMigrateFunds()
      // Check if execute migrate funds function before 2 days or after 3 days be reverted
      network.provider.send("evm_increaseTime", [86400]) // advance for 1 day
      await expect(vaultContract.migrateFunds()).to.be.revertedWith("Function locked")
      network.provider.send("evm_increaseTime", [86400*2+60]) // advance for another 2 days
      await expect(vaultContract.migrateFunds()).to.be.revertedWith("Function locked")
      // Execute unlock migrate funds function again
      await vaultContract.unlockMigrateFunds()
      network.provider.send("evm_increaseTime", [86400*2]) // advance for 2 days
      // Check if migration is failed till the strategy approve the migration
      await expect(vaultContract.migrateFunds()).to.be.revertedWith("ERC20: transfer amount exceeds allowance")

      // Approve for token transfer from Yearn Farmer to new strategy
      await strategyContract.approveMigrate()
      // Check if migrate funds function meet the requirements
      // Need to comment out deposit() function and all code below this to test this
      // await expect(vaultContract.migrateFunds()).to.be.revertedWith("No balance to migrate")
      // Need to comment out set/check pending strategy function and all code below this to test this
      // await expect(vaultContract.migrateFunds()).to.be.revertedWith("No pendingStrategy")

      // Check if the pending strategy doesn't have allowance for valut contract
      expect(await tokenContract.allowance(vaultContract.address, sampleContract.address)).to.equal(0)
      // Execute migrate funds function and check if event for migrateFunds is logged
      await expect(vaultContract.migrateFunds()).to.emit(vaultContract, "MigrateFunds")
          .withArgs(strategyContract.address, sampleContract.address, tokenBalance)
      // Check if token transfer correctly
      expect(await tokenContract.balanceOf(sampleContract.address)).to.equal(tokenBalance)
      expect(await tokenContract.balanceOf(strategyContract.address)).to.equal(0)
      // Check if the strategy approved the vault for the token
      expect(await tokenContract.allowance(vaultContract.address, sampleContract.address)).to.equal(UInt256Max())
      expect(await tokenContract.allowance(vaultContract.address, strategyContract.address)).to.equal(0)
      // Check if new strategy set and pending strategy reset to 0
      expect(await vaultContract.strategy()).to.equal(sampleContract.address)
      expect(await vaultContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
      // Check if execute migrate funds function again be reverted
      await expect(vaultContract.migrateFunds()).to.be.revertedWith("Function locked")
    })

    it("should set contract in vesting state correctly in strategy contract", async () => {
      const { deployerSigner, tokenContract, FARMContract, strategyContract, vaultContract, hfVaultContract, hfStakeContract } = await setup()
      const treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
      const communityBalance = await tokenContract.balanceOf(communityWalletAddress)
      // Deposit into Vault
      await tokenContract.approve(vaultContract.address, decimals(10000))
      await vaultContract.deposit(decimals(500))
      await vaultContract.deposit(decimals(500))
      await vaultContract.invest();
      const depositAmount = await strategyContract.getCurrentBalance(deployerSigner.address)
      closeTo(depositAmount, decimals(990))
      const poolAmount = await strategyContract.pool()
      closeTo(poolAmount, decimals(990))
      // Execute Harvest Finance earn function
      await hfVaultContract.doHardWork()
      // Check if corresponding function to be reverted if no vesting
      await expect(vaultContract.refund()).to.be.revertedWith("Not in vesting state")
      await expect(strategyContract.revertVesting()).to.be.revertedWith("Not in vesting state")
      await expect(strategyContract.approveMigrate()).to.be.revertedWith("Not in vesting state")
      await expect(strategyContract.reuseContract()).to.be.revertedWith("Not in vesting state")
      // Vesting the contract
      await strategyContract.vesting()
      // Check if vesting state change to true
      expect(await strategyContract.isVesting()).is.true
      // Check if corresponding function to be reverted in vesting state
      await expect(vaultContract.deposit(decimals(500))).to.be.revertedWith("Contract in vesting state")
      await expect(vaultContract.invest()).to.be.revertedWith("Contract in vesting state")
      await expect(vaultContract.withdraw(decimals(500))).to.be.revertedWith("Contract in vesting state")
      await expect(strategyContract.vesting()).to.be.revertedWith("Contract in vesting state")
      // Check if deployer balance in contract after vesting greater than deposit amount(because of profit)
      const deployerBalanceAfterVesting = await strategyContract.getCurrentBalance(deployerSigner.address)
      expect(deployerBalanceAfterVesting).to.gt(depositAmount)
      // Check if pool amount greater than amount before vesting after vesting state
      const poolAmountAfterVesting = await strategyContract.pool()
      expect(poolAmountAfterVesting).to.gt(poolAmount)
      // Check if deployer balance in contract == total token balance in contract == pool
      expect(deployerBalanceAfterVesting).to.equal(await tokenContract.balanceOf(strategyContract.address))
      expect(deployerBalanceAfterVesting).to.equal(poolAmountAfterVesting)
      // Check if amount of FARM and fToken is correct
      expect(await FARMContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.equal(0)
      // Check if amount fee transfer to treasury and community wallet correctly (50% split)
      expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gt(treasuryBalance.add(decimals(5)))
      expect(await tokenContract.balanceOf(communityWalletAddress)).to.gt(communityBalance.add(decimals(5)))
    })

    it("should revert contract vesting state and lend into Compound again correctly", async () => {
      const { clientSigner, tokenContract, FARMContract, vaultContract, strategyContract, hfVaultContract, hfStakeContract } = await setup()
      // Deposit token
      await tokenContract.transfer(clientSigner.address, decimals("2000"))
      await tokenContract.connect(clientSigner).approve(vaultContract.address, decimals("2000"))
      await vaultContract.connect(clientSigner).deposit(decimals("1000"))
      await vaultContract.invest();
      expect(await tokenContract.balanceOf(strategyContract.address)).to.equal(0)
      const hfStakeBalance = await hfStakeContract.balanceOf(strategyContract.address)

      // // Execute Harvest Finance earn function
      // await hfVaultContract.doHardWork()
      await increaseTime(global.SECONDS_IN_DAY);

      // Vesting contract
      await strategyContract.vesting()
      expect(await tokenContract.balanceOf(strategyContract.address)).to.gt(decimals("990"))
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.equal(0)
      // Revert vesting contract
      await strategyContract.revertVesting()
      // Check if vesting state change to false
      expect(await strategyContract.isVesting()).is.false
      // Check if everything goes normal after revert vesting and deposit into Harvest Finance Vault again
      expect(await tokenContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.be.closeTo(hfStakeBalance, decimals(1))
      let clientBalance = await strategyContract.getCurrentBalance(clientSigner.address)
      expect(clientBalance).to.gt(decimals("990"))
      await vaultContract.connect(clientSigner).deposit(decimals("1000"))
      await vaultContract.invest();
      clientBalance = await strategyContract.getCurrentBalance(clientSigner.address)
      expect(clientBalance).to.gt(decimals("1980"))
      await vaultContract.connect(clientSigner).withdraw(await vaultContract.balanceOf(clientSigner.address))
      expect(await tokenContract.balanceOf(clientSigner.address)).to.gt(clientBalance)
      expect(await vaultContract.balanceOf(clientSigner.address)).to.equal(0)
      expect(await vaultContract.totalSupply()).to.equal(0)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await FARMContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await strategyContract.pool()).to.equal(0)
    })

    it("should able to reuse Harvest Farmer contract", async () => {
      const { clientSigner, tokenContract, vaultContract, strategyContract, sampleContract, hfVaultContract, hfStakeContract, FARMContract } = await setup()
      // Transfer some token to client
      await tokenContract.transfer(clientSigner.address, decimals(1000))
      // Deposit into Harvest Farmer Vault contract
      await tokenContract.connect(clientSigner).approve(vaultContract.address, decimals(1000))
      await vaultContract.connect(clientSigner).deposit(decimals(500))
      await vaultContract.invest();

      // Execute Harvest Finance earn function
      await hfVaultContract.doHardWork()
      // Vesting the strategy contract and migrate funds to sample contract
      await strategyContract.vesting()
      await vaultContract.setPendingStrategy(sampleContract.address)
      await vaultContract.unlockMigrateFunds()

      await increaseTime(global.SECONDS_IN_DAY*2 + 1)
      await strategyContract.approveMigrate()
      await vaultContract.migrateFunds()
      // Migrate funds back to Harvest Farmer Strategy contract
      await vaultContract.setPendingStrategy(strategyContract.address)
      await vaultContract.unlockMigrateFunds()
      
      await increaseTime(global.SECONDS_IN_DAY*2 + 1)
      await sampleContract.approve(vaultContract.address, tokenContract.balanceOf(sampleContract.address))  
      await vaultContract.migrateFunds()
      // Reuse Harvest Farmer Strategy contract
      await strategyContract.reuseContract()
      // Check if everything is working fine
      await vaultContract.connect(clientSigner).deposit(decimals(500))
      await vaultContract.invest();

      expect(await strategyContract.getCurrentBalance(clientSigner.address)).to.gt(decimals(990))
      const hfStakeBalance = await hfStakeContract.balanceOf(strategyContract.address)
      await vaultContract.connect(clientSigner).withdraw((await vaultContract.balanceOf(clientSigner.address)).div(2))
      expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(decimals(495), decimals(1))
      expect(await strategyContract.getCurrentBalance(clientSigner.address)).to.gt(decimals(495))
      expect(await strategyContract.pool()).to.gt(decimals(495))
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.gte(hfStakeBalance.div(2))
      // expect(await FARMContract.balanceOf(strategyContract.address)).to.gt(0)
      const currentBalance = await strategyContract.getCurrentBalance(clientSigner.address)
      expect(currentBalance).to.gt(decimals(495))
      await vaultContract.connect(clientSigner).withdraw(await vaultContract.balanceOf(clientSigner.address))
      expect(await tokenContract.balanceOf(clientSigner.address)).to.gt(decimals(990))
      expect(await vaultContract.balanceOf(clientSigner.address)).to.equal(0)
      expect(await vaultContract.totalSupply()).to.equal(0)
      expect(await strategyContract.pool()).to.equal(0)
      expect(await hfVaultContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await hfStakeContract.balanceOf(strategyContract.address)).to.equal(0)
      expect(await FARMContract.balanceOf(strategyContract.address)).to.equal(0)
    })
  })
})
