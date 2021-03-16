const { expect } = require("chai")
const { ethers, deployments, waffle } = require("hardhat")
const { mainnet: network_ } = require("../addresses")
const IERC20_ABI = require("../abis/IERC20_ABI.json")
const ICERC20_ABI = require("../abis/CTOKEN_ABI.json")
const ICOMPERC20_ABI = require("../abis/COMP_ABI.json")
const ICOMPTROLLER_ABI = require("../abis/COMPTROLLER_ABI.json")
const sampleContract_JSON = require("../build/SampleContract.json")
require("dotenv").config()

const { tokenAddress, cTokenAddress, compTokenAddress, comptrollerAddress, uniswapRouterAddress, WETHAddress } = network_.USDT

const treasuryWalletAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
const communityWalletAddress = "0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0"

const decimals = (amount) => {
    return ethers.utils.parseUnits(amount.toString(), 6) // Change this to meet token decimals
}

describe("cfUSDT", () => {

    const setup = async () => {
        const [deployerSigner, clientSigner] = await ethers.getSigners()
        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, deployerSigner)
        const compTokenContract = new ethers.Contract(compTokenAddress, ICOMPERC20_ABI, deployerSigner)

        const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT")
        const dvlUSDTContract = await ethers.getContract("DAOVaultLowUSDT")

        const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvlUSDTContract.address, tokenContract.address])

        return { deployerSigner, clientSigner , tokenContract, cTokenContract, compTokenContract , cfUSDTContract, dvlUSDTContract, sampleContract }
    }

    beforeEach(async () => {
        await deployments.fixture(["hardhat"])
    })

    // it("should deploy contract correctly", async () => {
    //     const { deployerSigner, cfUSDTContract, dvlUSDTContract } = await setup()
    //     // Check if execute set vault function again to be reverted in DAOVaultLowUSDT contract
    //     await expect(cfUSDTContract.setVault(deployerSigner.address)).to.be.revertedWith("Vault set")
    //     // Check if contract owner is contract deployer in both contracts
    //     expect(await cfUSDTContract.owner()).to.equal(deployerSigner.address)
    //     expect(await dvlUSDTContract.owner()).to.equal(deployerSigner.address)
    //     // Check if token details are correct in DAOVaultLowUSDT contract
    //     expect(await dvlUSDTContract.name()).to.equal("DAO Vault Low USDT")
    //     expect(await dvlUSDTContract.symbol()).to.equal("dvlUSDT")
    //     expect(await dvlUSDTContract.decimals()).to.equal(6)
    //     // Check if all pre-set addresses are correct in DAOVaultLowUSDT contract
    //     expect(await dvlUSDTContract.token()).to.equal(tokenAddress)
    //     expect(await dvlUSDTContract.strategy()).to.equal(cfUSDTContract.address)
    //     expect(await dvlUSDTContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
    //     // Check if other pre-set variables are correct in DAOVaultLowUSDT contract
    //     expect(await dvlUSDTContract.canSetPendingStrategy()).is.true
    //     expect(await dvlUSDTContract.unlockTime()).to.equal(0)
    //     expect(await dvlUSDTContract.LOCKTIME()).to.equal(5*24*60*60)
    //     // Check if token details are correct in CompoundFarmer contract
    //     expect(await cfUSDTContract.name()).to.equal("Compound-Farmer USDT")
    //     expect(await cfUSDTContract.symbol()).to.equal("cfUSDT")
    //     expect(await cfUSDTContract.decimals()).to.equal(6)
    //     // Check if all pre-set addresses are correct in CompoundFarmer contract
    //     expect(await cfUSDTContract.token()).to.equal(tokenAddress)
    //     expect(await cfUSDTContract.cToken()).to.equal(cTokenAddress)
    //     expect(await cfUSDTContract.compToken()).to.equal(compTokenAddress)
    //     expect(await cfUSDTContract.comptroller()).to.equal(comptrollerAddress)
    //     expect(await cfUSDTContract.uniswapRouter()).to.equal(uniswapRouterAddress)
    //     expect(await cfUSDTContract.DAOVault()).to.equal(dvlUSDTContract.address)
    //     expect(await cfUSDTContract.WETH()).to.equal(WETHAddress)
    //     expect(await cfUSDTContract.treasuryWallet()).to.equal(treasuryWalletAddress)
    //     expect(await cfUSDTContract.communityWallet()).to.equal(communityWalletAddress)
    //     // Check if all pre-set fees are correct in CompoundFarmer contract
    //     expect(await cfUSDTContract.networkFeeTier2(0)).to.equal("50000000001")
    //     expect(await cfUSDTContract.networkFeeTier2(1)).to.equal("100000000000")
    //     expect(await cfUSDTContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("1", 12))
    //     expect(await cfUSDTContract.DENOMINATOR()).to.equal("10000")
    //     expect(await cfUSDTContract.networkFeePercentage(0)).to.equal("100")
    //     expect(await cfUSDTContract.networkFeePercentage(1)).to.equal("75")
    //     expect(await cfUSDTContract.networkFeePercentage(2)).to.equal("50")
    //     expect(await cfUSDTContract.customNetworkFeePercentage()).to.equal("25")
    //     expect(await cfUSDTContract.profileSharingFeePercentage()).to.equal("1000")
    //     expect(await cfUSDTContract.treasuryFee()).to.equal("5000")
    //     expect(await cfUSDTContract.communityFee()).to.equal("5000")
    //     // Check if all other pre-set variables are correct in CompoundFarmer contract
    //     expect(await cfUSDTContract.isVesting()).is.false
    //     expect(await cfUSDTContract.pool()).to.equal(0)
    // })

    // Check user functions
    describe("User functions", () => {
        // it("should able to deposit correctly", async () => {
        //     // Get deployer signer and deploy the contracts
        //     const { clientSigner, tokenContract, cfUSDTContract, dvlUSDTContract, sampleContract } = await setup()
        //     // Check if meet the function requirements
        //     let depositAmount = decimals("100")
        //     await tokenContract.transfer(clientSigner.address, depositAmount)
        //     await tokenContract.transfer(sampleContract.address, depositAmount)
        //     await tokenContract.connect(clientSigner).approve(cfUSDTContract.address, depositAmount)
        //     await expect(dvlUSDTContract.connect(clientSigner).deposit("0")).to.be.revertedWith("Amount must > 0")
        //     await expect(cfUSDTContract.connect(clientSigner).deposit("100")).to.be.revertedWith("Only can call from Vault")
        //     await sampleContract.approve(cfUSDTContract.address, depositAmount)
        //     await expect(sampleContract.deposit(depositAmount)).to.be.revertedWith("Only EOA")
        //     // Deposit token into contracts
        //     await dvlUSDTContract.connect(clientSigner).deposit(depositAmount)
        //     // Check if amount of deposit is correct
        //     expect(await cfUSDTContract.getBalance(clientSigner.address)).to.equal(decimals("100").mul(99).div(100)) // deposit fee 1%
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
        //     // Check if amount of shares token get is correct
        //     depositAmount = depositAmount.sub(depositAmount.mul(1).div(100))
        //     const shares = depositAmount.mul(await dvlUSDTContract.totalSupply()).div(await cfUSDTContract.pool())
        //     expect(await dvlUSDTContract.balanceOf(clientSigner.address)).to.equal(shares)
        //     expect(await cfUSDTContract.balanceOf(dvlUSDTContract.address)).to.equal(shares)
        //     expect(await cfUSDTContract.pool()).to.equal(depositAmount)
        //     expect(await cfUSDTContract.totalSupply()).to.equal(shares)
        //     expect(await dvlUSDTContract.totalSupply()).to.equal(shares)
        // })

        // it("should be able to withdraw correctly", async () => {
        //     // Get deployer signer and deploy the contracts
        //     const { clientSigner, tokenContract, cTokenContract, cfUSDTContract, dvlUSDTContract } = await setup()
        //     // Deposit token into contracts
        //     const depositAmount = decimals("1000")
        //     // const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
        //     await tokenContract.transfer(clientSigner.address, depositAmount)
        //     await tokenContract.connect(clientSigner).approve(cfUSDTContract.address, depositAmount)
        //     await dvlUSDTContract.connect(clientSigner).deposit(depositAmount)
        //     // Check if meet the function requirements
        //     await expect(dvlUSDTContract.connect(clientSigner).withdraw("0")).to.be.revertedWith("Amount must > 0")
        //     await expect(cfUSDTContract.connect(clientSigner).withdraw("200")).to.be.revertedWith("Only can call from Vault")
        //     await expect(dvlUSDTContract.withdraw("200")).to.be.revertedWith("Insufficient balance")
        //     // Withdraw all token from contracts
        //     const balance = await cfUSDTContract.getBalance(clientSigner.address)
        //     // const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, deployerSigner)
        //     const underlyingBalance = await cTokenContract.balanceOfUnderlying(cfUSDTContract.address)
        //     await dvlUSDTContract.connect(clientSigner).withdraw(balance)
        //     // Check if amount of withdraw is correct
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(underlyingBalance) // Some token will be added in withdraw block
        //     expect(await dvlUSDTContract.balanceOf(clientSigner.address)).to.equal(0)
        //     expect(await cfUSDTContract.balanceOf(dvlUSDTContract.address)).to.equal(0)
        //     expect(await cTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        // })

        // it("should be able to withdraw in several times correctly", async() => {
        //     // Get deployer and client signer and deploy the contracts
        //     const { clientSigner, tokenContract, cTokenContract, compTokenContract, cfUSDTContract, dvlUSDTContract } = await setup()
        //     // Deposit token into contracts
        //     const depositAmount = decimals("1000")
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
        //     await tokenContract.transfer(clientSigner.address, depositAmount)
        //     await tokenContract.connect(clientSigner).approve(cfUSDTContract.address, depositAmount)
        //     await dvlUSDTContract.connect(clientSigner).deposit(depositAmount)
        //     // Get initial value before withdraw
        //     const depositBalanceBoforeWithdraw = await cfUSDTContract.getBalance(clientSigner.address)
        //     const dvlTokenBalanceBeforeWithdraw = await dvlUSDTContract.balanceOf(clientSigner.address)
        //     const cfTokenBalanceBeforeWithdraw = await cfUSDTContract.balanceOf(dvlUSDTContract.address)
        //     const cTokenBalanceBeforeWithdraw = await cTokenContract.balanceOf(cfUSDTContract.address)
        //     const totalSupplyBeforeWithdraw = await cfUSDTContract.totalSupply()
        //     const poolBalanceBeforeWithdraw = await cfUSDTContract.pool()
        //     // Withdraw token from contracts 1st time
        //     let withdrawAmount = decimals("373")
        //     await dvlUSDTContract.connect(clientSigner).withdraw(withdrawAmount)
        //     // Check if amount of withdraw is correct
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(withdrawAmount)
        //     expect(await dvlUSDTContract.balanceOf(clientSigner.address)).to.equal(dvlTokenBalanceBeforeWithdraw.sub(withdrawAmount.mul(totalSupplyBeforeWithdraw).div(poolBalanceBeforeWithdraw)))
        //     expect(await cfUSDTContract.balanceOf(dvlUSDTContract.address)).to.equal(cfTokenBalanceBeforeWithdraw.sub(withdrawAmount.mul(totalSupplyBeforeWithdraw).div(poolBalanceBeforeWithdraw)))
        //     expect(await cTokenContract.balanceOf(cfUSDTContract.address)).to.equal(cTokenBalanceBeforeWithdraw.sub(cTokenBalanceBeforeWithdraw.mul(withdrawAmount).div(poolBalanceBeforeWithdraw)))
        //     expect(await cfUSDTContract.getBalance(clientSigner.address)).to.equal(depositBalanceBoforeWithdraw.sub(withdrawAmount))
        //     expect(await cfUSDTContract.pool()).to.equal(poolBalanceBeforeWithdraw.sub(withdrawAmount))
        //     expect(await cfUSDTContract.totalSupply()).to.equal(depositBalanceBoforeWithdraw.sub(withdrawAmount))
        //     expect(await dvlUSDTContract.totalSupply()).to.equal(depositBalanceBoforeWithdraw.sub(withdrawAmount))
        //     // Withdraw token from contracts 2nd time
        //     underlyingBalance = await cTokenContract.balanceOfUnderlying(cfUSDTContract.address)
        //     withdrawAmount = decimals("617")
        //     await dvlUSDTContract.connect(clientSigner).withdraw(withdrawAmount)
        //     // Check if amount of withdraw is correct
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(underlyingBalance)
        //     expect(await dvlUSDTContract.balanceOf(clientSigner.address)).to.equal(0)
        //     expect(await cfUSDTContract.balanceOf(dvlUSDTContract.address)).to.equal(0)
        //     expect(await cTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await compTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await cfUSDTContract.getBalance(clientSigner.address)).to.equal(0)
        //     expect(await cfUSDTContract.pool()).to.equal(0)
        //     expect(await cfUSDTContract.totalSupply()).to.equal(0)
        //     expect(await dvlUSDTContract.totalSupply()).to.equal(0)
        // })

        // it("should be able to mix and match deposit and withdraw correctly", async () => {
        //     const { deployerSigner, clientSigner, tokenContract, cfUSDTContract, dvlUSDTContract, cTokenContract, compTokenContract } = await setup()
        //     // Transfer some token to client
        //     await tokenContract.transfer(clientSigner.address, decimals("10000"))
        //     // Get data before deposit
        //     const deployerBalance = await tokenContract.balanceOf(deployerSigner.address)
        //     const clientBalance = await tokenContract.balanceOf(clientSigner.address)
        //     const treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
        //     const communityBalance = await tokenContract.balanceOf(communityWalletAddress)
        //     // Mix and match deposit and withdraw
        //     await tokenContract.approve(cfUSDTContract.address, decimals("10000"))
        //     await tokenContract.connect(clientSigner).approve(cfUSDTContract.address, decimals("10000"))
        //     await dvlUSDTContract.deposit(decimals("1234"))
        //     await dvlUSDTContract.connect(clientSigner).deposit(decimals("3210"))
        //     await dvlUSDTContract.deposit(decimals("2345"))
        //     await dvlUSDTContract.connect(clientSigner).withdraw(decimals("2020"))
        //     await dvlUSDTContract.withdraw(decimals("1989"))
        //     await dvlUSDTContract.connect(clientSigner).deposit(decimals("378"))
        //     await dvlUSDTContract.connect(clientSigner).withdraw("1532120000")
        //     await dvlUSDTContract.withdraw("1554210000")
        //     // Check if final number is correct
        //     expect(await cfUSDTContract.pool()).to.equal(0)
        //     expect(await cfUSDTContract.getBalance(deployerSigner.address)).to.equal(0)
        //     expect(await cfUSDTContract.getBalance(clientSigner.address)).to.equal(0)
        //     expect(await cfUSDTContract.totalSupply()).to.equal(0)
        //     expect(await cfUSDTContract.balanceOf(dvlUSDTContract.address)).to.equal(0)
        //     expect(await dvlUSDTContract.totalSupply()).to.equal(0)
        //     expect(await dvlUSDTContract.balanceOf(deployerSigner.address)).to.equal(0)
        //     expect(await dvlUSDTContract.balanceOf(clientSigner.address)).to.equal(0)
        //     expect(await cTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await cTokenContract.balanceOfUnderlying(cfUSDTContract.address)).to.equal(0)
        //     expect(await compTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await tokenContract.balanceOf(deployerSigner.address)).to.gte(deployerBalance.sub("35790000"))
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(clientBalance.sub("35880000"))
        //     // Check if treasury and community wallet receive fees correctly
        //     expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryBalance.add("35835000"))
        //     expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityBalance)
        // })

        // it("should be able to refund correctly when contract is in vesting state", async () => {
        //     const { deployerSigner, clientSigner , tokenContract, cTokenContract, compTokenContract, cfUSDTContract, dvlUSDTContract } = await setup()
        //     const depositAmount = decimals("1000")
        //     await tokenContract.approve(cfUSDTContract.address, depositAmount)
        //     await dvlUSDTContract.deposit(depositAmount)
        //     await tokenContract.transfer(clientSigner.address, depositAmount)
        //     await tokenContract.connect(clientSigner).approve(cfUSDTContract.address, depositAmount)
        //     await dvlUSDTContract.connect(clientSigner).deposit(depositAmount)
        //     const balanceBeforeRefund = await tokenContract.balanceOf(deployerSigner.address)
        //     expect(await cfUSDTContract.getSharesValue(deployerSigner.address)).to.equal(0)
        //     const depositBalance = await cfUSDTContract.getBalance(deployerSigner.address)
        //     const treasuryBalanceBeforeVesting = await tokenContract.balanceOf(treasuryWalletAddress)
        //     const communityBalanceBeforeVesting = await tokenContract.balanceOf(communityWalletAddress)
        //     expect(await dvlUSDTContract.balanceOf(deployerSigner.address)).to.equal(decimals("990"))
        //     expect(await dvlUSDTContract.balanceOf(clientSigner.address)).to.equal(decimals("990"))
        //     expect(await cfUSDTContract.balanceOf(dvlUSDTContract.address)).to.equal(decimals("1980"))
        //     expect(await cfUSDTContract.totalSupply()).to.equal(decimals("1980"))
        //     expect(await dvlUSDTContract.totalSupply()).to.equal(decimals("1980"))
        //     expect(await cfUSDTContract.pool()).to.equal(decimals("1980"))
        //     expect(await tokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await cTokenContract.balanceOf(cfUSDTContract.address)).to.gt(0)
        //     expect(await compTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     await cfUSDTContract.vesting()
        //     expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryBalanceBeforeVesting)
        //     expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityBalanceBeforeVesting)
        //     const refundBalance = await cfUSDTContract.getSharesValue(deployerSigner.address)
        //     expect(refundBalance).to.gte(depositBalance)
        //     expect(await cfUSDTContract.pool()).to.gt(decimals("1980"))
        //     expect(await tokenContract.balanceOf(cfUSDTContract.address)).to.gt(decimals("1980"))
        //     expect(await cTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await compTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     await dvlUSDTContract.connect(clientSigner).refund()
        //     await dvlUSDTContract.refund()
        //     expect(await tokenContract.balanceOf(deployerSigner.address)).to.gte(depositBalance.mul(1).div(100))
        //     expect(await dvlUSDTContract.balanceOf(deployerSigner.address)).to.equal(0)
        //     expect(await cfUSDTContract.balanceOf(dvlUSDTContract.address)).to.equal(0)
        //     expect(await cfUSDTContract.totalSupply()).to.equal(0)
        //     expect(await dvlUSDTContract.totalSupply()).to.equal(0)
        //     expect(await cfUSDTContract.pool()).to.equal(0)
        //     expect(await tokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await cTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await compTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        // })
    })

    // Test admin functions
    describe("Admin functions", () => {
        // it("should able to transfer contract ownership to other address by contract owner only in both contracts", async () => {
        //     const { deployerSigner, clientSigner, cfUSDTContract, dvlUSDTContract } = await setup()
        //     // Check if contract ownership is owner before transfer
        //     expect(await cfUSDTContract.owner()).to.equal(deployerSigner.address)
        //     expect(await dvlUSDTContract.owner()).to.equal(deployerSigner.address)
        //     // Check if new owner cannot execute admin functions yet
        //     await expect(dvlUSDTContract.connect(clientSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(dvlUSDTContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(dvlUSDTContract.connect(clientSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).initialDeposit()).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setNetworkFeeTier2(["100000000", "200000000"])).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setCustomNetworkFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setProfileSharingFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setAmountOutMinPerc(9000)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setDeadline(12000)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).approveMigrate()).to.be.revertedWith("Ownable: caller is not the owner")
        //     // Transfer contract ownership from owner to new owner
        //     await dvlUSDTContract.connect(deployerSigner).transferOwnership(clientSigner.address)
        //     await cfUSDTContract.connect(deployerSigner).transferOwnership(clientSigner.address)
        //     // Check if contract ownership is new owner after transfer
        //     expect(await dvlUSDTContract.owner()).to.equal(clientSigner.address)
        //     expect(await cfUSDTContract.owner()).to.equal(clientSigner.address)
        //     // Check if new owner can execute admin function
        //     await expect(dvlUSDTContract.connect(clientSigner).unlockMigrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(dvlUSDTContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(dvlUSDTContract.connect(clientSigner).migrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).initialDeposit()).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setNetworkFeeTier2(["100000000", "200000000"])).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setCustomNetworkFeePercentage(3000)).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setProfileSharingFeePercentage(3000)).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setAmountOutMinPerc(9000)).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).setDeadline(12000)).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).vesting()).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(clientSigner).approveMigrate()).not.to.be.revertedWith("Ownable: caller is not the owner")
        //     // Check if original owner neither can execute admin function nor transfer back ownership
        //     await expect(dvlUSDTContract.connect(deployerSigner).transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(dvlUSDTContract.connect(deployerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(dvlUSDTContract.connect(deployerSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(dvlUSDTContract.connect(deployerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).initialDeposit()).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).setNetworkFeeTier2(["100000000", "200000000"])).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).setNetworkFeePercentage([3000, 3000, 3000])).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).setCustomNetworkFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).setProfileSharingFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).setAmountOutMinPerc(9000)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).setDeadline(12000)).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
        //     await expect(cfUSDTContract.connect(deployerSigner).approveMigrate()).to.be.revertedWith("Ownable: caller is not the owner")
        // })

        // it("should able to set pending strategy, migrate funds and set new strategy correctly in DAOVaultLowUSDT contract", async () => {
        //     const { deployerSigner, tokenContract, cfUSDTContract, dvlUSDTContract } = await setup()
        //     // Set pending strategy
        //     const sampleContract_JSON = require("../build/SampleContract.json")
        //     const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvlUSDTContract.address, tokenContract.address])
        //     await dvlUSDTContract.setPendingStrategy(sampleContract.address)
        //     // Check if pending strategy is set with given address
        //     expect(await dvlUSDTContract.pendingStrategy()).to.equal(sampleContract.address)
        //     // Deposit into daoVaultUSDT and execute vesting function
        //     await tokenContract.approve(cfUSDTContract.address, "100000000000")
        //     await dvlUSDTContract.deposit("100000000000")
        //     await cfUSDTContract.vesting()
        //     // Get Yearn Farmer token balance before migrate
        //     const tokenBalance = await tokenContract.balanceOf(cfUSDTContract.address)
        //     // Execute unlock migrate funds function
        //     await dvlUSDTContract.unlockMigrateFunds()
        //     // Check if execute migrate funds function before 2 days or after 3 days be reverted
        //     network.provider.send("evm_increaseTime", [86400]) // advance for 1 day
        //     await expect(dvlUSDTContract.migrateFunds()).to.be.revertedWith("Function locked")
        //     network.provider.send("evm_increaseTime", [86400*2+60]) // advance for another 2 days
        //     await expect(dvlUSDTContract.migrateFunds()).to.be.revertedWith("Function locked")
        //     // Execute unlock migrate funds function again
        //     await dvlUSDTContract.unlockMigrateFunds()
        //     network.provider.send("evm_increaseTime", [86400*2]) // advance for 2 days
        //     // Approve for token transfer from Yearn Farmer to new strategy
        //     await cfUSDTContract.approveMigrate()
        //     // Check if migrate funds function meet the requirements
        //     // Need to comment out deposit() function and all code below this to test this
        //     // await expect(dvlUSDTContract.migrateFunds()).to.be.revertedWith("No balance to migrate")
        //     // Need to comment out set/check pending strategy function and all code below this to test this
        //     // await expect(dvlUSDTContract.migrateFunds()).to.be.revertedWith("No pendingStrategy")
        //     // Execute migrate funds function and check if event for migrateFunds is logged
        //     await expect(dvlUSDTContract.migrateFunds()).to.emit(dvlUSDTContract, "MigrateFunds")
        //         .withArgs(cfUSDTContract.address, sampleContract.address, tokenBalance)
        //     // Check if token transfer correctly
        //     expect(await tokenContract.balanceOf(sampleContract.address)).to.equal(tokenBalance)
        //     expect(await tokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     // Check if cfUSDT in daoVaultUSDT burn to 0
        //     expect(await cfUSDTContract.balanceOf(dvlUSDTContract.address)).to.equal(0)
        //     // Check if new strategy set and pending strategy reset to 0
        //     expect(await dvlUSDTContract.strategy()).to.equal(sampleContract.address)
        //     expect(await dvlUSDTContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
        //     // Check if execute migrate funds function again be reverted
        //     await expect(dvlUSDTContract.migrateFunds()).to.be.revertedWith("Function locked")
        // })

        // it("should able to set new treasury wallet correctly in CompoundFarmerUSDT contract", async () => {
        //     const { clientSigner, tokenContract, cfUSDTContract, dvlUSDTContract } = await setup()
        //     // Set new treasury wallet and check if event for setTreasuryWallet function is logged
        //     await expect(cfUSDTContract.setTreasuryWallet(clientSigner.address))
        //         .to.emit(cfUSDTContract, "SetTreasuryWallet")
        //         .withArgs(treasuryWalletAddress, clientSigner.address)
        //     // Check if new treasury wallet is set to the contract
        //     expect(await cfUSDTContract.treasuryWallet()).to.equal(clientSigner.address)
        //     // Check if new treasury wallet receive fees
        //     await tokenContract.approve(cfUSDTContract.address, "1000000000")
        //     await dvlUSDTContract.deposit("200000000")
        //     // Deposit amount within network fee tier 1 hence fee = 0.5%
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.equal("1000000")
        // })

        // it("should able to set new community wallet correctly in CompoundFarmerUSDT contract", async () => {
        //     const { clientSigner, tokenContract, cfUSDTContract, dvlUSDTContract } = await setup()
        //     // Set new community wallet and check if event for setCommunityWallet function is logged
        //     await expect(cfUSDTContract.setCommunityWallet(clientSigner.address))
        //         .to.emit(cfUSDTContract, "SetCommunityWallet")
        //         .withArgs(communityWalletAddress, clientSigner.address)
        //     // Check if new community wallet is set to the contract
        //     expect(await cfUSDTContract.communityWallet()).to.equal(clientSigner.address)
        //     // Check if new treasury wallet receive fees
        //     await tokenContract.approve(cfUSDTContract.address, "1000000000")
        //     await dvlUSDTContract.deposit("200000000")
        //     // Deposit amount within network fee tier 1 hence fee = 0.5%
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.equal("1000000")
        // })

        // it("should able to set new network fee tier correctly in CompoundFarmerUSDT contract", async () => {
        //     const { cfUSDTContract } = await setup()
        //     // Check if function parameter meet the requirements
        //     await expect(cfUSDTContract.setNetworkFeeTier2([0, "10000000000"]))
        //         .to.be.revertedWith("Minimun amount cannot be 0")
        //     await expect(cfUSDTContract.setNetworkFeeTier2(["10000000000", "10000000000"]))
        //         .to.be.revertedWith("Maximun amount must greater than minimun amount")
        //     // Set new network fee tier 2 and check if event for setNetworkFeeTier2 is logged
        //     await expect(cfUSDTContract.setNetworkFeeTier2(["60000000001", "600000000000"]))
        //         .to.emit(cfUSDTContract, "SetNetworkFeeTier2")
        //         .withArgs(["50000000001", "100000000000"], ["60000000001", "600000000000"])
        //     // Check if network fee tier 2 amount is set correctly
        //     expect(await cfUSDTContract.networkFeeTier2(0)).to.equal("60000000001")
        //     expect(await cfUSDTContract.networkFeeTier2(1)).to.equal("600000000000")
        // })

        // it("should able to set new custom network fee tier correctly in CompoundFarmerUSDT contract", async () => {
        //     const { cfUSDTContract } = await setup()
        //     // Check if function parameter meet the requirements
        //     await expect(cfUSDTContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 10)))
        //         .to.be.revertedWith("Custom network fee tier must greater than tier 2")
        //     // Set new custom network fee tier and check if event for setCustomNetworkFeeTier is logged
        //     await expect(cfUSDTContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("2", 12)))
        //         .to.emit(cfUSDTContract, "SetCustomNetworkFeeTier")
        //         .withArgs("1000000000000", "2000000000000")
        //     // Check if custom network fee tier amount is set correctly
        //     expect(await cfUSDTContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("2", 12))
        // })

        // it("should able to set new network fee percentage correctly in CompoundFarmerUSDT contract", async () => {
        //     const { cfUSDTContract } = await setup()
        //     // Check if function parameter meet the requirements
        //     await expect(cfUSDTContract.setNetworkFeePercentage([3000, 0, 0]))
        //         .to.be.revertedWith("Network fee percentage cannot be more than 30%")
        //     await expect(cfUSDTContract.setNetworkFeePercentage([0, 3000, 0]))
        //         .to.be.revertedWith("Network fee percentage cannot be more than 30%")
        //     await expect(cfUSDTContract.setNetworkFeePercentage([0, 0, 3000]))
        //         .to.be.revertedWith("Network fee percentage cannot be more than 30%")
        //     // Set network fee percentage and check if event for setNetworkFeePercentage is logged
        //     await expect(cfUSDTContract.setNetworkFeePercentage([200, 100, 50]))
        //         .to.emit(cfUSDTContract, "SetNetworkFeePercentage")
        //         .withArgs([100, 75, 50], [200, 100, 50])
        //     // Check if network fee percentage is set correctly
        //     expect(await cfUSDTContract.networkFeePercentage(0)).to.equal(200)
        //     expect(await cfUSDTContract.networkFeePercentage(1)).to.equal(100)
        //     expect(await cfUSDTContract.networkFeePercentage(2)).to.equal(50)
        // })

        // it("should able to set new custom network fee percentage correctly in CompoundFarmerUSDT contract", async () => {
        //     const { cfUSDTContract } = await setup()
        //     // Check if function parameter meet the requirements
        //     await expect(cfUSDTContract.setCustomNetworkFeePercentage(60))
        //         .to.be.revertedWith("Custom network fee percentage cannot be more than tier 2")
        //     // Set custom network fee percentage and check if event for setCustomNetworkFeePercentage is logged
        //     await expect(cfUSDTContract.setCustomNetworkFeePercentage(10))
        //         .to.emit(cfUSDTContract, "SetCustomNetworkFeePercentage")
        //         .withArgs(25, 10)
        //     // Check if network fee percentage is set correctly
        //     expect(await cfUSDTContract.customNetworkFeePercentage()).to.equal(10)
        // })

        // it("should able to set new profile sharing fee percentage correctly in CompoundFarmerUSDT contract", async () => {
        //     const { cfUSDTContract } = await setup()
        //     // Check if function parameter meet the requirements
        //     await expect(cfUSDTContract.setProfileSharingFeePercentage(3000))
        //         .to.be.revertedWith("Profile sharing fee percentage cannot be more than 30%")
        //     // Set profile sharing fee percentage and check if event for setProfileSharingFeePercentage is logged
        //     await expect(cfUSDTContract.setProfileSharingFeePercentage(2000))
        //         .to.emit(cfUSDTContract, "SetProfileSharingFeePercentage")
        //         .withArgs(1000, 2000)
        //     // Check if profile sharing fee percentage is set correctly
        //     expect(await cfUSDTContract.profileSharingFeePercentage()).to.equal(2000)
        // })

        // it("should set amount out minimum percentage on Uniswap swap function correctly in CompoundFarmerUSDT contract", async () => {
        //     const { cfUSDTContract } = await setup()
        //     // Check if meet the requirements
        //     await expect(cfUSDTContract.setAmountOutMinPerc(9900)).to.be.revertedWith("Amount out minimun > 97%")
        //     // Check if able to set new amount out minimum percentage
        //     await expect(cfUSDTContract.setAmountOutMinPerc(8000)).not.to.be.reverted
        // })

        // it("should set deadline on Uniswap swap function correctly in CompoundFarmerUSDT contract", async () => {
        //     const { cfUSDTContract } = await setup()
        //     // Check if meet the requirements
        //     await expect(cfUSDTContract.setDeadline(1)).to.be.revertedWith("Deadline < 60 seconds")
        //     // Check if able to set new deadline
        //     await expect(cfUSDTContract.setDeadline(300)).not.to.be.reverted
        // })

        it("should set contract in vesting state correctly in CompoundFarmerUSDT contract", async () => {
            // Get address of deployer and deploy the contracts
            const { deployerSigner, tokenContract, cfUSDTContract, dvlUSDTContract } = await setup()
            // Deposit into CompoundFarmerUSDT through daoVaultUSDT
            await tokenContract.approve(cfUSDTContract.address, "1000000000")
            await dvlUSDTContract.deposit(["100000000", "200000000"])
            // Check if get shares value return 0 if no vesting (this function only available after vesting state)
            expect(await cfUSDTContract.getSharesValue(deployerSigner.address)).to.equal(0)
            // Check if corresponding function to be reverted if no vesting (these function only available after vesting state)
            await expect(dvlUSDTContract.refund()).to.be.revertedWith("Not in vesting state")
            await expect(cfUSDTContract.approveMigrate()).to.be.revertedWith("Not in vesting state")
            await cfUSDTContract.vesting()
            // Check if vesting state is true
            expect(await cfUSDTContract.isVesting()).is.true
            // Check if corresponding function to be reverted in vesting state
            await expect(dvlUSDTContract.deposit(["100000000", "200000000"])).to.be.revertedWith("Contract in vesting state")
            await expect(dvlUSDTContract.withdraw(["50000000", "100000000"])).to.be.revertedWith("Contract in vesting state")
            // Check if corresponding getter function return 0 in vesting state
            expect(await cfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(0)
            expect(await cfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(0)
            // Check if execute vesting function again to be reverted
            await expect(cfUSDTContract.vesting()).to.be.revertedWith("Already in vesting state")
            // Check if pool reset to 0 after vesting state
            expect(await cfUSDTContract.pool()).to.equal(0)
        })

        // it("should send profit to treasury and community wallet correctly after vesting state in CompoundFarmerUSDT contract", async () => {
        //     // Get address of deployer and deploy the contracts
        //     const { deployerSigner, tokenContract, yEarnContract, yVaultContract, cfUSDTContract, dvlUSDTContract } = await setup()
        //     // Deposit into CompoundFarmerUSDT through daoVaultUSDT
        //     await tokenContract.approve(cfUSDTContract.address, "1000000000")
        //     await dvlUSDTContract.deposit(["100000000", "200000000"])
        //     const treasuryWalletBalanceBeforeVesting = await tokenContract.balanceOf(treasuryWalletAddress)
        //     const communityWalletBalanceBeforeVesting = await tokenContract.balanceOf(communityWalletAddress)
        //     // Get off-chain Yearn earn and vault actual withdraw amount
        //     const earnDepositBalance = await cfUSDTContract.getEarnDepositBalance(deployerSigner.address)
        //     const vaultDepositBalance = await cfUSDTContract.getVaultDepositBalance(deployerSigner.address)
        //     const offChainActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(
        //         (earnDepositBalance.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken()))
        //     ).div(await yEarnContract.totalSupply())
        //     const offChainActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(
        //         (vaultDepositBalance.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance()))
        //     ).div(await yVaultContract.totalSupply())
        //     // Transfer some token to Yearn Farmer contract treat as profit
        //     await tokenContract.transfer(cfUSDTContract.address, "100000000")
        //     await cfUSDTContract.vesting()
        //     // Check if balance token in Yearn Farmer contract correctly after fee
        //     expect(await tokenContract.balanceOf(cfUSDTContract.address)).to.equal(await cfUSDTContract.getSharesValue(deployerSigner.address))
        //     // Check if amount fee transfer to treasury and community wallet correctly (50% split)
        //     const profit = (await tokenContract.balanceOf(cfUSDTContract.address)).sub(offChainActualEarnWithdrawAmount.add(offChainActualVaultWithdrawAmount))
        //     const profileSharingFee = profit.mul(10).div(100)
        //     expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryWalletBalanceBeforeVesting.add(profileSharingFee.mul(50).div(100)))
        //     expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityWalletBalanceBeforeVesting.add(profileSharingFee.mul(50).div(100)))
        // })
    })
    

    // it("should work", async () => {
    //     // Get deployer signer and deploy the contracts
    //     const [deployerSigner, _] = await ethers.getSigners()
    //     const CfUSDTContract = await ethers.getContractFactory("CompoundFarmerUSDT", deployerSigner)
    //     const cfUSDTContract = await CfUSDTContract.deploy()
    //     const DvlUSDTContract = await ethers.getContractFactory("DAOVaultLowUSDT", deployerSigner)
    //     const dvlUSDTContract = await DvlUSDTContract.deploy(tokenAddress, cfUSDTContract.address)
    //     await cfUSDTContract.setVault(dvlUSDTContract.address)

    //     const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
    //     const amount = decimals("1000")
    //     await tokenContract.approve(cfUSDTContract.address, amount)
    //     await dvlUSDTContract.deposit(amount)
    //     console.log((await tokenContract.balanceOf(deployerSigner.address)).toString())

    //     const dvlUSDTTokenAmount = dvlUSDTContract.balanceOf(deployerSigner.address)

    //     const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, deployerSigner)
    //     console.log((await cTokenContract.balanceOfUnderlying(cfUSDTContract.address)).toString())
    //     const cTokenAmount = await cTokenContract.balanceOf(cfUSDTContract.address)
    //     console.log((await cTokenContract.balanceOf(cfUSDTContract.address)).toString())

    //     const COMPContract = new ethers.Contract(COMPAddress, ICOMPERC20_ABI, deployerSigner)
    //     console.log((await tokenContract.balanceOf(cfUSDTContract.address)).toString())

    //     await network.provider.request({
    //         method: "hardhat_impersonateAccount",
    //         params: [unlockedCOMPWalletAddress]
    //     })
    //     const unlockedCOMPSigner = await ethers.provider.getSigner(unlockedCOMPWalletAddress)
    //     await COMPContract.connect(unlockedCOMPSigner).transfer(cfUSDTContract.address, ethers.utils.parseUnits("1", 17))

    //     await dvlUSDTContract.withdraw(dvlUSDTTokenAmount)
    //     const tokenAmount = await tokenContract.balanceOf(deployerSigner.address)
    //     console.log(ethers.utils.formatUnits(tokenAmount, 6))
    //     // console.log((await cTokenContract.balanceOf(cfUSDTContract.address)).toString())

    //     const unlockedcUSDTWalletAddress = "0x2bddEd18E2CA464355091266B7616956944ee7eE"
    //     await network.provider.request({
    //         method: "hardhat_impersonateAccount",
    //         params: [unlockedcUSDTWalletAddress]
    //     })
    //     const unlockedcUSDTSigner = await ethers.provider.getSigner(unlockedcUSDTWalletAddress)
    //     const COMPContract = new ethers.Contract(COMPAddress, ICOMPERC20_ABI, deployerSigner)
    //     const comptrollerContract = new ethers.Contract(comptrollerAddress, ICOMPTROLLER_ABI, deployerSigner)
    //     // console.log((await comptrollerContract.compRate()).toString())
    //     console.log(ethers.utils.formatUnits(await tokenContract.balanceOf(unlockedcUSDTWalletAddress), 6))
    //     console.log(ethers.utils.formatUnits(await cTokenContract.balanceOf(unlockedcUSDTWalletAddress), 8))
    //     console.log(ethers.utils.formatUnits(await COMPContract.balanceOf(unlockedcUSDTWalletAddress), 18))
    //     await comptrollerContract.claimComp(unlockedcUSDTWalletAddress, [cTokenAddress])
    //     await cTokenContract.connect(unlockedcUSDTSigner).redeem(await cTokenContract.balanceOf(unlockedcUSDTWalletAddress))
    //     console.log()
    //     console.log(ethers.utils.formatUnits(await tokenContract.balanceOf(unlockedcUSDTWalletAddress), 6))
    //     console.log(ethers.utils.formatUnits(await cTokenContract.balanceOf(unlockedcUSDTWalletAddress), 8))
    //     console.log(ethers.utils.formatUnits(await COMPContract.balanceOf(unlockedcUSDTWalletAddress), 18))

    //     const provider = ethers.provider
    //     const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, provider)
    //     let compoundAPR = (await cTokenContract.supplyRatePerBlock()).mul("2102400")
    //     let compoundAPR = (await cfUSDTContract.getBaseAPR())
    //     compoundAPR = ethers.utils.formatUnits(compoundAPR, 16)
    //     console.log(`APR: ${compoundAPR.slice(0, 4)}%`)
    // })
})