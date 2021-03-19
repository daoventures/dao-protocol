const { expect } = require("chai")
const { ethers, deployments, waffle } = require("hardhat")
const { mainnet: network_ } = require("../addresses")
const IERC20_ABI = require("../abis/IERC20_ABI.json")
const ICERC20_ABI = require("../abis/CTOKEN_ABI.json")
const ICOMPERC20_ABI = require("../abis/COMP_ABI.json")
const sampleContract_JSON = require("../build/SampleContract.json")
require("dotenv").config()

const { compTokenAddress, comptrollerAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL
const { tokenAddress, cTokenAddress } = network_.USDC

const treasuryWalletAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
const communityWalletAddress = "0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0"

const decimals = (amount) => {
    return ethers.utils.parseUnits(amount.toString(), 6) // Change this to meet token decimals
}

describe("cfUSDC", () => {

    const setup = async () => {
        const [deployerSigner, clientSigner] = await ethers.getSigners()
        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, deployerSigner)
        const compTokenContract = new ethers.Contract(compTokenAddress, ICOMPERC20_ABI, deployerSigner)

        const cfUSDCContract = await ethers.getContract("CompoundFarmerUSDC")
        const dvlUSDCContract = await ethers.getContract("DAOVaultLowUSDC")

        const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvlUSDCContract.address, tokenContract.address])

        return { deployerSigner, clientSigner , tokenContract, cTokenContract, compTokenContract , cfUSDCContract, dvlUSDCContract, sampleContract }
    }

    beforeEach(async () => {
        await deployments.fixture(["hardhat"])
    })

    it("should deploy contract correctly", async () => {
        const { deployerSigner, cfUSDCContract, dvlUSDCContract } = await setup()
        // Check if execute set vault function again to be reverted in DAOVaultLowUSDC contract
        await expect(cfUSDCContract.setVault(deployerSigner.address)).to.be.revertedWith("Vault set")
        // Check if contract owner is contract deployer in both contracts
        expect(await cfUSDCContract.owner()).to.equal(deployerSigner.address)
        expect(await dvlUSDCContract.owner()).to.equal(deployerSigner.address)
        // Check if token details are correct in DAOVaultLowUSDC contract
        expect(await dvlUSDCContract.name()).to.equal("DAO Vault Low USDC")
        expect(await dvlUSDCContract.symbol()).to.equal("dvlUSDC")
        expect(await dvlUSDCContract.decimals()).to.equal(6)
        // Check if all pre-set addresses are correct in DAOVaultLowUSDC contract
        expect(await dvlUSDCContract.token()).to.equal(tokenAddress)
        expect(await dvlUSDCContract.strategy()).to.equal(cfUSDCContract.address)
        expect(await dvlUSDCContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
        // Check if other pre-set variables are correct in DAOVaultLowUSDC contract
        expect(await dvlUSDCContract.canSetPendingStrategy()).is.true
        expect(await dvlUSDCContract.unlockTime()).to.equal(0)
        expect(await dvlUSDCContract.LOCKTIME()).to.equal(2*24*60*60)
        // Check if token details are correct in CompoundFarmer contract
        expect(await cfUSDCContract.name()).to.equal("Compound-Farmer USDC")
        expect(await cfUSDCContract.symbol()).to.equal("cfUSDC")
        expect(await cfUSDCContract.decimals()).to.equal(6)
        // Check if all pre-set addresses are correct in CompoundFarmer contract
        expect(await cfUSDCContract.token()).to.equal(tokenAddress)
        expect(await cfUSDCContract.cToken()).to.equal(cTokenAddress)
        expect(await cfUSDCContract.compToken()).to.equal(compTokenAddress)
        expect(await cfUSDCContract.comptroller()).to.equal(comptrollerAddress)
        expect(await cfUSDCContract.uniswapRouter()).to.equal(uniswapRouterAddress)
        expect(await cfUSDCContract.DAOVault()).to.equal(dvlUSDCContract.address)
        expect(await cfUSDCContract.WETH()).to.equal(WETHAddress)
        expect(await cfUSDCContract.treasuryWallet()).to.equal(treasuryWalletAddress)
        expect(await cfUSDCContract.communityWallet()).to.equal(communityWalletAddress)
        // Check if all pre-set fees are correct in CompoundFarmer contract
        expect(await cfUSDCContract.networkFeeTier2(0)).to.equal("50000000001")
        expect(await cfUSDCContract.networkFeeTier2(1)).to.equal("100000000000")
        expect(await cfUSDCContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("1", 12))
        expect(await cfUSDCContract.DENOMINATOR()).to.equal("10000")
        expect(await cfUSDCContract.networkFeePercentage(0)).to.equal("100")
        expect(await cfUSDCContract.networkFeePercentage(1)).to.equal("75")
        expect(await cfUSDCContract.networkFeePercentage(2)).to.equal("50")
        expect(await cfUSDCContract.customNetworkFeePercentage()).to.equal("25")
        expect(await cfUSDCContract.profileSharingFeePercentage()).to.equal("1000")
        expect(await cfUSDCContract.treasuryFee()).to.equal("5000")
        expect(await cfUSDCContract.communityFee()).to.equal("5000")
        // Check if all other pre-set variables are correct in CompoundFarmer contract
        expect(await cfUSDCContract.isVesting()).is.false
        expect(await cfUSDCContract.pool()).to.equal(0)
        expect(await cfUSDCContract.amountOutMinPerc()).to.equal(9500)
        expect(await cfUSDCContract.deadline()).to.equal(60*20) // 20 minutes
    })

    // Check user functions
    describe("User functions", () => {
        it("should able to deposit correctly", async () => {
            // Get deployer signer and deploy the contracts
            const { clientSigner, tokenContract, cfUSDCContract, dvlUSDCContract, sampleContract } = await setup()
            // Check if meet the function requirements
            let depositAmount = decimals("100")
            await tokenContract.transfer(clientSigner.address, depositAmount)
            await tokenContract.transfer(sampleContract.address, depositAmount)
            await tokenContract.connect(clientSigner).approve(cfUSDCContract.address, depositAmount)
            await expect(dvlUSDCContract.connect(clientSigner).deposit("0")).to.be.revertedWith("Amount must > 0")
            await expect(cfUSDCContract.connect(clientSigner).deposit("100")).to.be.revertedWith("Only can call from Vault")
            await sampleContract.approve(cfUSDCContract.address, depositAmount)
            await expect(sampleContract.deposit(depositAmount)).to.be.revertedWith("Only EOA")
            // Deposit token into contracts
            await dvlUSDCContract.connect(clientSigner).deposit(depositAmount)
            // Check if amount of deposit is correct
            expect(await cfUSDCContract.getCurrentBalance(clientSigner.address)).to.equal(decimals("100").mul(99).div(100)) // deposit fee 1%
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
            // Check if amount of shares token get is correct
            depositAmount = depositAmount.sub(depositAmount.mul(1).div(100))
            const shares = depositAmount.mul(await dvlUSDCContract.totalSupply()).div(await cfUSDCContract.pool())
            expect(await dvlUSDCContract.balanceOf(clientSigner.address)).to.equal(shares)
            expect(await cfUSDCContract.balanceOf(dvlUSDCContract.address)).to.equal(shares)
            expect(await cfUSDCContract.pool()).to.equal(depositAmount)
            expect(await cfUSDCContract.totalSupply()).to.equal(shares)
            expect(await dvlUSDCContract.totalSupply()).to.equal(shares)
        })

        it("should deduct correct network fee based on tier in CompoundFarmerUSDC contract", async () => {
            const { deployerSigner, tokenContract, dvlUSDCContract, cfUSDCContract } = await setup()
            let treasuryBalance, communityBalance, depositBalance, fee
            treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            communityBalance = await tokenContract.balanceOf(communityWalletAddress)
            const depositTier1 = decimals("10000")
            const depositTier2 = decimals("100000")
            const depositTier3 = decimals("500000")
            const customDepositTier = decimals("1000000")
            await tokenContract.approve(cfUSDCContract.address, depositTier1.add(depositTier2).add(depositTier3).add(customDepositTier))
            // Tier 1 deposit
            await dvlUSDCContract.deposit(depositTier1)
            // Check deposit balance in contract and check fees receive by treasury and community wallet
            fee = depositTier1.mul(100).div(10000)
            expect(await cfUSDCContract.getCurrentBalance(deployerSigner.address)).to.equal(depositTier1.sub(fee))
            depositBalance = depositTier1.sub(fee)
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryBalance.add(fee.mul(1).div(2)))
            treasuryBalance = treasuryBalance.add(fee.mul(1).div(2))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityBalance.add(fee.mul(1).div(2)))
            communityBalance = communityBalance.add(fee.mul(1).div(2))
            // Tier 2 deposit
            await dvlUSDCContract.deposit(depositTier2)
            // Check deposit balance in contract and check fees receive by treasury and community wallet
            fee = depositTier2.mul(75).div(10000)
            expect(await cfUSDCContract.getCurrentBalance(deployerSigner.address)).to.equal(depositBalance.add(depositTier2.sub(fee)))
            depositBalance = depositBalance.add(depositTier2.sub(fee))
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryBalance.add(fee.mul(1).div(2)))
            treasuryBalance = treasuryBalance.add(fee.mul(1).div(2))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityBalance.add(fee.mul(1).div(2)))
            communityBalance = communityBalance.add(fee.mul(1).div(2))
            // Tier 3 deposit
            await dvlUSDCContract.deposit(depositTier3)
            // Check deposit balance in contract and check fees receive by treasury and community wallet
            fee = depositTier3.mul(50).div(10000)
            expect(await cfUSDCContract.getCurrentBalance(deployerSigner.address)).to.equal(depositBalance.add(depositTier3.sub(fee)))
            depositBalance = depositBalance.add(depositTier3.sub(fee))
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryBalance.add(fee.mul(1).div(2)))
            treasuryBalance = treasuryBalance.add(fee.mul(1).div(2))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityBalance.add(fee.mul(1).div(2)))
            communityBalance = communityBalance.add(fee.mul(1).div(2))
            // Custom tier deposit
            await dvlUSDCContract.deposit(customDepositTier)
            // Check deposit balance in contract and check fees receive by treasury and community wallet
            fee = customDepositTier.mul(25).div(10000)
            expect(await cfUSDCContract.getCurrentBalance(deployerSigner.address)).to.equal(depositBalance.add(customDepositTier.sub(fee)))
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryBalance.add(fee.mul(1).div(2)))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityBalance.add(fee.mul(1).div(2)))
        })

        it("should be able to withdraw correctly", async () => {
            // Get deployer signer and deploy the contracts
            const { clientSigner, tokenContract, cTokenContract, cfUSDCContract, dvlUSDCContract } = await setup()
            // Deposit token into contracts
            const depositAmount = decimals("1000")
            // const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
            await tokenContract.transfer(clientSigner.address, depositAmount)
            await tokenContract.connect(clientSigner).approve(cfUSDCContract.address, depositAmount)
            await dvlUSDCContract.connect(clientSigner).deposit(depositAmount)
            // Check if meet the function requirements
            await expect(dvlUSDCContract.connect(clientSigner).withdraw("0")).to.be.revertedWith("Amount must > 0")
            await expect(cfUSDCContract.connect(clientSigner).withdraw("200")).to.be.revertedWith("Only can call from Vault")
            await expect(dvlUSDCContract.withdraw("200")).to.be.revertedWith("Insufficient balance")
            // Withdraw all token from contracts
            const balance = await cfUSDCContract.getCurrentBalance(clientSigner.address)
            // const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, deployerSigner)
            const underlyingBalance = await cTokenContract.balanceOfUnderlying(cfUSDCContract.address)
            await dvlUSDCContract.connect(clientSigner).withdraw(balance)
            // Check if amount of withdraw is correct
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(underlyingBalance) // Some token will be added in withdraw block
            expect(await dvlUSDCContract.balanceOf(clientSigner.address)).to.equal(0)
            expect(await cfUSDCContract.balanceOf(dvlUSDCContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
        })

        it("should be able to withdraw in several times correctly", async() => {
            // Get deployer and client signer and deploy the contracts
            const { clientSigner, tokenContract, cTokenContract, compTokenContract, cfUSDCContract, dvlUSDCContract } = await setup()
            // Deposit token into contracts
            const depositAmount = decimals("1000")
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
            await tokenContract.transfer(clientSigner.address, depositAmount)
            await tokenContract.connect(clientSigner).approve(cfUSDCContract.address, depositAmount)
            await dvlUSDCContract.connect(clientSigner).deposit(depositAmount)
            // Get initial value before withdraw
            const depositBalanceBoforeWithdraw = await cfUSDCContract.getCurrentBalance(clientSigner.address)
            const dvlTokenBalanceBeforeWithdraw = await dvlUSDCContract.balanceOf(clientSigner.address)
            const cfTokenBalanceBeforeWithdraw = await cfUSDCContract.balanceOf(dvlUSDCContract.address)
            const cTokenBalanceBeforeWithdraw = await cTokenContract.balanceOf(cfUSDCContract.address)
            const totalSupplyBeforeWithdraw = await cfUSDCContract.totalSupply()
            const poolBalanceBeforeWithdraw = await cfUSDCContract.pool()
            // Withdraw token from contracts 1st time
            let withdrawAmount = decimals("373")
            await dvlUSDCContract.connect(clientSigner).withdraw(withdrawAmount)
            // Check if amount of withdraw is correct
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(withdrawAmount)
            expect(await dvlUSDCContract.balanceOf(clientSigner.address)).to.equal(dvlTokenBalanceBeforeWithdraw.sub(withdrawAmount.mul(totalSupplyBeforeWithdraw).div(poolBalanceBeforeWithdraw)))
            expect(await cfUSDCContract.balanceOf(dvlUSDCContract.address)).to.equal(cfTokenBalanceBeforeWithdraw.sub(withdrawAmount.mul(totalSupplyBeforeWithdraw).div(poolBalanceBeforeWithdraw)))
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.equal(cTokenBalanceBeforeWithdraw.sub(cTokenBalanceBeforeWithdraw.mul(withdrawAmount).div(poolBalanceBeforeWithdraw)))
            expect(await compTokenContract.balanceOf(cfUSDCContract.address)).to.be.gt(0)
            expect(await cfUSDCContract.getCurrentBalance(clientSigner.address)).to.equal(depositBalanceBoforeWithdraw.sub(withdrawAmount))
            expect(await cfUSDCContract.pool()).to.equal(poolBalanceBeforeWithdraw.sub(withdrawAmount))
            expect(await cfUSDCContract.totalSupply()).to.equal(depositBalanceBoforeWithdraw.sub(withdrawAmount))
            expect(await dvlUSDCContract.totalSupply()).to.equal(depositBalanceBoforeWithdraw.sub(withdrawAmount))
            // Withdraw token from contracts 2nd time
            underlyingBalance = await cTokenContract.balanceOfUnderlying(cfUSDCContract.address)
            withdrawAmount = decimals("617")
            await dvlUSDCContract.connect(clientSigner).withdraw(withdrawAmount)
            // Check if amount of withdraw is correct
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(underlyingBalance)
            expect(await dvlUSDCContract.balanceOf(clientSigner.address)).to.equal(0)
            expect(await cfUSDCContract.balanceOf(dvlUSDCContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await cfUSDCContract.getCurrentBalance(clientSigner.address)).to.equal(0)
            expect(await cfUSDCContract.pool()).to.equal(0)
            expect(await cfUSDCContract.totalSupply()).to.equal(0)
            expect(await dvlUSDCContract.totalSupply()).to.equal(0)
        })

        it("should deduct correct profile sharing fee when withdraw in CompoundFarmerUSDC contract", async () => {
            const { clientSigner, tokenContract, cfUSDCContract, dvlUSDCContract } = await setup()
            const treasuryWalletBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityWalletBalance = await tokenContract.balanceOf(communityWalletAddress)
            await tokenContract.transfer(clientSigner.address, decimals("1000"))
            // Deposit into contract
            await tokenContract.connect(clientSigner).approve(cfUSDCContract.address, decimals("1000"))
            await dvlUSDCContract.connect(clientSigner).deposit(decimals("1000"))
            const deployerBalance = await tokenContract.balanceOf(clientSigner.address)
            // Transfer some token to contract as profit
            await tokenContract.transfer(cfUSDCContract.address, decimals("100"))
            const networkFee = decimals("1000").mul(1).div(100)
            const profileSharingFee = decimals("100").mul(1).div(10)
            const profit = decimals("100").sub(profileSharingFee)
            // Withdraw from contract and check if fee deduct correctly
            await dvlUSDCContract.connect(clientSigner).withdraw(decimals("990"))
            expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(deployerBalance.add(decimals("990")).add(profit), 100)
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.be.closeTo(treasuryWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), 50)
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.be.closeTo(communityWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), 50)
        })

        it("should be able to mix and match deposit and withdraw correctly", async () => {
            const { deployerSigner, clientSigner, tokenContract, cfUSDCContract, dvlUSDCContract, cTokenContract, compTokenContract } = await setup()
            // Transfer some token to client
            await tokenContract.transfer(clientSigner.address, decimals("10000"))
            // Get data before deposit
            const deployerBalance = await tokenContract.balanceOf(deployerSigner.address)
            const clientBalance = await tokenContract.balanceOf(clientSigner.address)
            const treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityBalance = await tokenContract.balanceOf(communityWalletAddress)
            // Mix and match deposit and withdraw
            await tokenContract.approve(cfUSDCContract.address, decimals("10000"))
            await tokenContract.connect(clientSigner).approve(cfUSDCContract.address, decimals("10000"))
            await dvlUSDCContract.deposit(decimals("1234"))
            await dvlUSDCContract.connect(clientSigner).deposit(decimals("3210"))
            await dvlUSDCContract.deposit(decimals("2345"))
            await dvlUSDCContract.connect(clientSigner).withdraw(decimals("2020"))
            await dvlUSDCContract.withdraw(decimals("1989"))
            await dvlUSDCContract.connect(clientSigner).deposit(decimals("378"))
            await dvlUSDCContract.connect(clientSigner).withdraw("1532120000")
            await dvlUSDCContract.withdraw("1554210000")
            // Check if final number is correct
            expect(await cfUSDCContract.pool()).to.equal(0)
            expect(await cfUSDCContract.getCurrentBalance(deployerSigner.address)).to.equal(0)
            expect(await cfUSDCContract.getCurrentBalance(clientSigner.address)).to.equal(0)
            expect(await cfUSDCContract.totalSupply()).to.equal(0)
            expect(await cfUSDCContract.balanceOf(dvlUSDCContract.address)).to.equal(0)
            expect(await dvlUSDCContract.totalSupply()).to.equal(0)
            expect(await dvlUSDCContract.balanceOf(deployerSigner.address)).to.equal(0)
            expect(await dvlUSDCContract.balanceOf(clientSigner.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOfUnderlying(cfUSDCContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.gte(deployerBalance.sub("35790000"))
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(clientBalance.sub("35880000"))
            // Check if treasury and community wallet receive fees correctly
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryBalance.add("35835000"))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityBalance)
        })

        it("should be able to refund correctly when contract is in vesting state", async () => {
            const { deployerSigner, clientSigner , tokenContract, cTokenContract, compTokenContract, cfUSDCContract, dvlUSDCContract } = await setup()
            // Deposit into contract and check if all parameter is correct
            const depositAmount = decimals("1000")
            await tokenContract.approve(cfUSDCContract.address, depositAmount)
            await dvlUSDCContract.deposit(depositAmount)
            await tokenContract.transfer(clientSigner.address, depositAmount)
            await tokenContract.connect(clientSigner).approve(cfUSDCContract.address, depositAmount)
            await dvlUSDCContract.connect(clientSigner).deposit(depositAmount)
            const depositBalance = await cfUSDCContract.getCurrentBalance(deployerSigner.address)
            const treasuryBalanceBeforeVesting = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityBalanceBeforeVesting = await tokenContract.balanceOf(communityWalletAddress)
            expect(await dvlUSDCContract.balanceOf(deployerSigner.address)).to.equal(decimals("990"))
            expect(await dvlUSDCContract.balanceOf(clientSigner.address)).to.equal(decimals("990"))
            expect(await cfUSDCContract.balanceOf(dvlUSDCContract.address)).to.equal(decimals("1980"))
            expect(await cfUSDCContract.totalSupply()).to.equal(decimals("1980"))
            expect(await dvlUSDCContract.totalSupply()).to.equal(decimals("1980"))
            expect(await cfUSDCContract.pool()).to.equal(decimals("1980"))
            expect(await tokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.gt(0)
            expect(await compTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            // Vesting the contract
            await cfUSDCContract.vesting()
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryBalanceBeforeVesting)
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityBalanceBeforeVesting)
            const refundBalance = await cfUSDCContract.getCurrentBalance(deployerSigner.address)
            expect(refundBalance).to.gte(depositBalance)
            expect(await cfUSDCContract.pool()).to.gt(decimals("1980"))
            expect(await tokenContract.balanceOf(cfUSDCContract.address)).to.gt(decimals("1980"))
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            // Refund from vesting contract
            await dvlUSDCContract.connect(clientSigner).refund()
            await dvlUSDCContract.refund()
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.gte(depositBalance.mul(1).div(100))
            expect(await dvlUSDCContract.balanceOf(deployerSigner.address)).to.equal(0)
            expect(await cfUSDCContract.balanceOf(dvlUSDCContract.address)).to.equal(0)
            expect(await cfUSDCContract.totalSupply()).to.equal(0)
            expect(await dvlUSDCContract.totalSupply()).to.equal(0)
            expect(await cfUSDCContract.pool()).to.equal(0)
            expect(await tokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
        })

        it("should deduct correct profile sharing fee when vesting in CompoundFarmerUSDC contract", async () => {
            const { clientSigner, tokenContract, cfUSDCContract, dvlUSDCContract } = await setup()
            const treasuryWalletBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityWalletBalance = await tokenContract.balanceOf(communityWalletAddress)
            await tokenContract.transfer(clientSigner.address, decimals("1000"))
            // Deposit into contract
            await tokenContract.connect(clientSigner).approve(cfUSDCContract.address, decimals("1000"))
            await dvlUSDCContract.connect(clientSigner).deposit(decimals("1000"))
            const deployerBalance = await tokenContract.balanceOf(clientSigner.address)
            // Transfer some token to contract as profit
            await tokenContract.transfer(cfUSDCContract.address, decimals("100"))
            const networkFee = decimals("1000").mul(1).div(100)
            const profileSharingFee = decimals("100").mul(1).div(10)
            const profit = decimals("100").sub(profileSharingFee)
            // Vesting contract and check if fee deduct correctly
            await cfUSDCContract.vesting()
            await dvlUSDCContract.connect(clientSigner).refund()
            expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(deployerBalance.add(decimals("990")).add(profit), 100)
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.be.closeTo(treasuryWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), 50)
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.be.closeTo(communityWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), 50)
        })
    })

    // Test admin functions
    describe("Admin functions", () => {
        it("should able to transfer contract ownership to other address by contract owner only in both contracts", async () => {
            const { deployerSigner, clientSigner, cfUSDCContract, dvlUSDCContract } = await setup()
            // Check if contract ownership is owner before transfer
            expect(await cfUSDCContract.owner()).to.equal(deployerSigner.address)
            expect(await dvlUSDCContract.owner()).to.equal(deployerSigner.address)
            // Check if new owner cannot execute admin functions yet
            await expect(dvlUSDCContract.connect(clientSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlUSDCContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlUSDCContract.connect(clientSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setNetworkFeeTier2(["100000000", "200000000"])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setCustomNetworkFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setProfileSharingFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setAmountOutMinPerc(9000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setDeadline(12000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).approveMigrate()).to.be.revertedWith("Ownable: caller is not the owner")
            // Transfer contract ownership from owner to new owner
            await dvlUSDCContract.connect(deployerSigner).transferOwnership(clientSigner.address)
            await cfUSDCContract.connect(deployerSigner).transferOwnership(clientSigner.address)
            // Check if contract ownership is new owner after transfer
            expect(await dvlUSDCContract.owner()).to.equal(clientSigner.address)
            expect(await cfUSDCContract.owner()).to.equal(clientSigner.address)
            // Check if new owner can execute admin function
            await expect(dvlUSDCContract.connect(clientSigner).unlockMigrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlUSDCContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlUSDCContract.connect(clientSigner).migrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setNetworkFeeTier2(["100000000", "200000000"])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setCustomNetworkFeePercentage(3000)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setProfileSharingFeePercentage(3000)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setAmountOutMinPerc(9000)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).setDeadline(12000)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).vesting()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(clientSigner).approveMigrate()).not.to.be.revertedWith("Ownable: caller is not the owner")
            // Check if original owner neither can execute admin function nor transfer back ownership
            await expect(dvlUSDCContract.connect(deployerSigner).transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlUSDCContract.connect(deployerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlUSDCContract.connect(deployerSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlUSDCContract.connect(deployerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).setNetworkFeeTier2(["100000000", "200000000"])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).setNetworkFeePercentage([3000, 3000, 3000])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).setCustomNetworkFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).setProfileSharingFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).setAmountOutMinPerc(9000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).setDeadline(12000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfUSDCContract.connect(deployerSigner).approveMigrate()).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("should able to set new treasury wallet correctly in CompoundFarmerUSDC contract", async () => {
            const { clientSigner, tokenContract, cfUSDCContract, dvlUSDCContract } = await setup()
            // Set new treasury wallet and check if event for setTreasuryWallet function is logged
            await expect(cfUSDCContract.setTreasuryWallet(clientSigner.address))
                .to.emit(cfUSDCContract, "SetTreasuryWallet")
                .withArgs(treasuryWalletAddress, clientSigner.address)
            // Check if new treasury wallet is set to the contract
            expect(await cfUSDCContract.treasuryWallet()).to.equal(clientSigner.address)
            // Check if new treasury wallet receive fees
            await tokenContract.approve(cfUSDCContract.address, "1000000000")
            await dvlUSDCContract.deposit("200000000")
            // Deposit amount within network fee tier 1 hence fee = 0.5%
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal("1000000")
        })

        it("should able to set new community wallet correctly in CompoundFarmerUSDC contract", async () => {
            const { clientSigner, tokenContract, cfUSDCContract, dvlUSDCContract } = await setup()
            // Set new community wallet and check if event for setCommunityWallet function is logged
            await expect(cfUSDCContract.setCommunityWallet(clientSigner.address))
                .to.emit(cfUSDCContract, "SetCommunityWallet")
                .withArgs(communityWalletAddress, clientSigner.address)
            // Check if new community wallet is set to the contract
            expect(await cfUSDCContract.communityWallet()).to.equal(clientSigner.address)
            // Check if new treasury wallet receive fees
            await tokenContract.approve(cfUSDCContract.address, "1000000000")
            await dvlUSDCContract.deposit("200000000")
            // Deposit amount within network fee tier 1 hence fee = 0.5%
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal("1000000")
        })

        it("should able to set new network fee tier correctly in CompoundFarmerUSDC contract", async () => {
            const { cfUSDCContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfUSDCContract.setNetworkFeeTier2([0, "10000000000"]))
                .to.be.revertedWith("Minimun amount cannot be 0")
            await expect(cfUSDCContract.setNetworkFeeTier2(["10000000000", "10000000000"]))
                .to.be.revertedWith("Maximun amount must greater than minimun amount")
            // Set new network fee tier 2 and check if event for setNetworkFeeTier2 is logged
            await expect(cfUSDCContract.setNetworkFeeTier2(["60000000001", "600000000000"]))
                .to.emit(cfUSDCContract, "SetNetworkFeeTier2")
                .withArgs(["50000000001", "100000000000"], ["60000000001", "600000000000"])
            // Check if network fee tier 2 amount is set correctly
            expect(await cfUSDCContract.networkFeeTier2(0)).to.equal("60000000001")
            expect(await cfUSDCContract.networkFeeTier2(1)).to.equal("600000000000")
        })

        it("should able to set new custom network fee tier correctly in CompoundFarmerUSDC contract", async () => {
            const { cfUSDCContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfUSDCContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 10)))
                .to.be.revertedWith("Custom network fee tier must greater than tier 2")
            // Set new custom network fee tier and check if event for setCustomNetworkFeeTier is logged
            await expect(cfUSDCContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("2", 12)))
                .to.emit(cfUSDCContract, "SetCustomNetworkFeeTier")
                .withArgs("1000000000000", "2000000000000")
            // Check if custom network fee tier amount is set correctly
            expect(await cfUSDCContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("2", 12))
        })

        it("should able to set new network fee percentage correctly in CompoundFarmerUSDC contract", async () => {
            const { cfUSDCContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfUSDCContract.setNetworkFeePercentage([3000, 0, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 30%")
            await expect(cfUSDCContract.setNetworkFeePercentage([0, 3000, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 30%")
            await expect(cfUSDCContract.setNetworkFeePercentage([0, 0, 3000]))
                .to.be.revertedWith("Network fee percentage cannot be more than 30%")
            // Set network fee percentage and check if event for setNetworkFeePercentage is logged
            await expect(cfUSDCContract.setNetworkFeePercentage([200, 100, 50]))
                .to.emit(cfUSDCContract, "SetNetworkFeePercentage")
                .withArgs([100, 75, 50], [200, 100, 50])
            // Check if network fee percentage is set correctly
            expect(await cfUSDCContract.networkFeePercentage(0)).to.equal(200)
            expect(await cfUSDCContract.networkFeePercentage(1)).to.equal(100)
            expect(await cfUSDCContract.networkFeePercentage(2)).to.equal(50)
        })

        it("should able to set new custom network fee percentage correctly in CompoundFarmerUSDC contract", async () => {
            const { cfUSDCContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfUSDCContract.setCustomNetworkFeePercentage(60))
                .to.be.revertedWith("Custom network fee percentage cannot be more than tier 2")
            // Set custom network fee percentage and check if event for setCustomNetworkFeePercentage is logged
            await expect(cfUSDCContract.setCustomNetworkFeePercentage(10))
                .to.emit(cfUSDCContract, "SetCustomNetworkFeePercentage")
                .withArgs(25, 10)
            // Check if network fee percentage is set correctly
            expect(await cfUSDCContract.customNetworkFeePercentage()).to.equal(10)
        })

        it("should able to set new profile sharing fee percentage correctly in CompoundFarmerUSDC contract", async () => {
            const { cfUSDCContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfUSDCContract.setProfileSharingFeePercentage(3000))
                .to.be.revertedWith("Profile sharing fee percentage cannot be more than 30%")
            // Set profile sharing fee percentage and check if event for setProfileSharingFeePercentage is logged
            await expect(cfUSDCContract.setProfileSharingFeePercentage(2000))
                .to.emit(cfUSDCContract, "SetProfileSharingFeePercentage")
                .withArgs(1000, 2000)
            // Check if profile sharing fee percentage is set correctly
            expect(await cfUSDCContract.profileSharingFeePercentage()).to.equal(2000)
        })

        it("should set amount out minimum percentage on Uniswap swap function correctly in CompoundFarmerUSDC contract", async () => {
            const { cfUSDCContract } = await setup()
            // Check if meet the requirements
            await expect(cfUSDCContract.setAmountOutMinPerc(9900)).to.be.revertedWith("Amount out minimun > 97%")
            // Set new amount out minimum percentage
            await cfUSDCContract.setAmountOutMinPerc(8000)
            // Check if new amount out minimum percentage set correctly
            expect(await cfUSDCContract.amountOutMinPerc()).to.equal(8000)
        })

        it("should set deadline on Uniswap swap function correctly in CompoundFarmerUSDC contract", async () => {
            const { cfUSDCContract } = await setup()
            // Check if meet the requirements
            await expect(cfUSDCContract.setDeadline(1)).to.be.revertedWith("Deadline < 60 seconds")
            // Check if able to set new deadline
            await cfUSDCContract.setDeadline(300)
            // Check if new amount out minimum percentage set correctly
            expect(await cfUSDCContract.deadline()).to.equal(300)
        })

        it("should able to set pending strategy, migrate funds and set new strategy correctly in DAOVaultLowUSDC contract", async () => {
            const { deployerSigner, tokenContract, cfUSDCContract, dvlUSDCContract } = await setup()
            // Set pending strategy
            const sampleContract_JSON = require("../build/SampleContract.json")
            const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvlUSDCContract.address, tokenContract.address])
            await dvlUSDCContract.setPendingStrategy(sampleContract.address)
            // Check if pending strategy is set with given address
            expect(await dvlUSDCContract.pendingStrategy()).to.equal(sampleContract.address)
            // Deposit into daoVaultUSDC and execute vesting function
            await tokenContract.approve(cfUSDCContract.address, "100000000000")
            await dvlUSDCContract.deposit("100000000000")
            await cfUSDCContract.vesting()
            // Get Yearn Farmer token balance before migrate
            const tokenBalance = await tokenContract.balanceOf(cfUSDCContract.address)
            // Execute unlock migrate funds function
            await dvlUSDCContract.unlockMigrateFunds()
            // Check if execute migrate funds function before 2 days or after 3 days be reverted
            network.provider.send("evm_increaseTime", [86400]) // advance for 1 day
            await expect(dvlUSDCContract.migrateFunds()).to.be.revertedWith("Function locked")
            network.provider.send("evm_increaseTime", [86400*2+60]) // advance for another 2 days
            await expect(dvlUSDCContract.migrateFunds()).to.be.revertedWith("Function locked")
            // Execute unlock migrate funds function again
            await dvlUSDCContract.unlockMigrateFunds()
            network.provider.send("evm_increaseTime", [86400*2]) // advance for 2 days
            // Approve for token transfer from Yearn Farmer to new strategy
            await cfUSDCContract.approveMigrate()
            // Check if migrate funds function meet the requirements
            // Need to comment out deposit() function and all code below this to test this
            // await expect(dvlUSDCContract.migrateFunds()).to.be.revertedWith("No balance to migrate")
            // Need to comment out set/check pending strategy function and all code below this to test this
            // await expect(dvlUSDCContract.migrateFunds()).to.be.revertedWith("No pendingStrategy")
            // Execute migrate funds function and check if event for migrateFunds is logged
            await expect(dvlUSDCContract.migrateFunds()).to.emit(dvlUSDCContract, "MigrateFunds")
                .withArgs(cfUSDCContract.address, sampleContract.address, tokenBalance)
            // Check if token transfer correctly
            expect(await tokenContract.balanceOf(sampleContract.address)).to.equal(tokenBalance)
            expect(await tokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            // Check if cfUSDC in daoVaultUSDC burn to 0
            expect(await cfUSDCContract.balanceOf(dvlUSDCContract.address)).to.equal(0)
            // Check if new strategy set and pending strategy reset to 0
            expect(await dvlUSDCContract.strategy()).to.equal(sampleContract.address)
            expect(await dvlUSDCContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
            // Check if execute migrate funds function again be reverted
            await expect(dvlUSDCContract.migrateFunds()).to.be.revertedWith("Function locked")
        })

        it("should set contract in vesting state correctly in CompoundFarmerUSDC contract", async () => {
            const { deployerSigner, tokenContract, cTokenContract, compTokenContract, cfUSDCContract, dvlUSDCContract } = await setup()
            const treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityBalance = await tokenContract.balanceOf(communityWalletAddress)
            // Deposit into CompoundFarmerUSDC through daoVaultUSDC
            await tokenContract.approve(cfUSDCContract.address, "10000000000")
            await dvlUSDCContract.deposit("500000000")
            await dvlUSDCContract.deposit("500000000")
            const depositAmount = await cfUSDCContract.getCurrentBalance(deployerSigner.address)
            expect(depositAmount).to.equal("990000000")
            const poolAmount = await cfUSDCContract.pool()
            expect(poolAmount).to.equal("990000000")
            // Check if corresponding function to be reverted if no vesting
            await expect(dvlUSDCContract.refund()).to.be.revertedWith("Not in vesting state")
            await expect(cfUSDCContract.revertVesting()).to.be.revertedWith("Not in vesting state")
            await expect(cfUSDCContract.approveMigrate()).to.be.revertedWith("Not in vesting state")
            // Vesting the contract
            await cfUSDCContract.vesting()
            // Check if vesting state change to true
            expect(await cfUSDCContract.isVesting()).is.true
            // Check if corresponding function to be reverted in vesting state
            await expect(dvlUSDCContract.deposit("500000000")).to.be.revertedWith("Contract in vesting state")
            await expect(dvlUSDCContract.withdraw("500000000")).to.be.revertedWith("Contract in vesting state")
            // Check if deployer balance in contract after vesting greater than deposit amount(because of profit)
            const deployerBalanceAfterVesting = await cfUSDCContract.getCurrentBalance(deployerSigner.address)
            expect(deployerBalanceAfterVesting).to.gt(depositAmount)
            // Check if pool amount greater than amount before vesting after vesting state
            const poolAmountAfterVesting = await cfUSDCContract.pool()
            expect(poolAmountAfterVesting).to.gt(poolAmount)
            // Check if deployer balance in contract == total token balance in contract == pool
            expect(deployerBalanceAfterVesting).to.equal(await tokenContract.balanceOf(cfUSDCContract.address))
            expect(deployerBalanceAfterVesting).to.equal(poolAmountAfterVesting)
            // Check if amount of cToken and compToken is correct
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            // Check if execute vesting function again to be reverted
            await expect(cfUSDCContract.vesting()).to.be.revertedWith("Already in vesting state")
            // Check if amount fee transfer to treasury and community wallet correctly (50% split)
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gt(treasuryBalance.add("2500000"))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.gt(communityBalance.add("2500000"))
        })

        it("should revert contract vesting state and lend into Compound again correctly", async () => {
            const { clientSigner, tokenContract, cTokenContract, compTokenContract, dvlUSDCContract, cfUSDCContract } = await setup()
            // Deposit token
            await tokenContract.transfer(clientSigner.address, decimals("2000"))
            await tokenContract.connect(clientSigner).approve(cfUSDCContract.address, decimals("2000"))
            await dvlUSDCContract.connect(clientSigner).deposit(decimals("1000"))
            expect(await tokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            const cTokenBalance = await cTokenContract.balanceOf(cfUSDCContract.address)
            // Vesting contract
            await cfUSDCContract.vesting()
            expect(await tokenContract.balanceOf(cfUSDCContract.address)).to.gt(decimals("990"))
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            // Revert vesting contract
            await cfUSDCContract.revertVesting()
            // Check if vesting state change to false
            expect(await cfUSDCContract.isVesting()).is.false
            // Check if everything goes normal after revert vesting and lend into Compound again
            expect(await tokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.be.closeTo(cTokenBalance, 200000)
            let clientBalance = await cfUSDCContract.getCurrentBalance(clientSigner.address)
            expect(clientBalance).to.gt(decimals("990"))
            await dvlUSDCContract.connect(clientSigner).deposit(decimals("1000"))
            clientBalance = clientBalance.add(decimals("990"))
            await dvlUSDCContract.connect(clientSigner).withdraw(clientBalance)
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gt(clientBalance)
            expect(await dvlUSDCContract.balanceOf(clientSigner.address)).to.equal(0)
            expect(await cfUSDCContract.balanceOf(dvlUSDCContract.address)).to.equal(0)
            expect(await dvlUSDCContract.totalSupply()).to.equal(0)
            expect(await cTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfUSDCContract.address)).to.equal(0)
            expect(await cfUSDCContract.totalSupply()).to.equal(0)
            expect(await cfUSDCContract.pool()).to.equal(0)
        })
    })
})