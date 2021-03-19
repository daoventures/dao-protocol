const { expect } = require("chai")
const { ethers, deployments, waffle } = require("hardhat")
const { mainnet: network_ } = require("../addresses")
const IERC20_ABI = require("../abis/IERC20_ABI.json")
const ICERC20_ABI = require("../abis/CTOKEN_ABI.json")
const ICOMPERC20_ABI = require("../abis/COMP_ABI.json")
const sampleContract_JSON = require("../build/SampleContract.json")
require("dotenv").config()

const { compTokenAddress, comptrollerAddress, uniswapRouterAddress, WETHAddress } = network_.GLOBAL
const { tokenAddress, cTokenAddress } = network_.DAI

const treasuryWalletAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
const communityWalletAddress = "0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0"

const decimals = (amount) => {
    return ethers.utils.parseUnits(amount.toString(), 18) // Change this to meet token decimals
}

describe("cfDAI", () => {

    const setup = async () => {
        const [deployerSigner, clientSigner] = await ethers.getSigners()
        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, deployerSigner)
        const compTokenContract = new ethers.Contract(compTokenAddress, ICOMPERC20_ABI, deployerSigner)

        const cfDAIContract = await ethers.getContract("CompoundFarmerDAI")
        const dvlDAIContract = await ethers.getContract("DAOVaultLowDAI")

        const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvlDAIContract.address, tokenContract.address])

        return { deployerSigner, clientSigner , tokenContract, cTokenContract, compTokenContract , cfDAIContract, dvlDAIContract, sampleContract }
    }

    beforeEach(async () => {
        await deployments.fixture(["hardhat"])
    })

    it("should deploy contract correctly", async () => {
        const { deployerSigner, cfDAIContract, dvlDAIContract } = await setup()
        // Check if execute set vault function again to be reverted in DAOVaultLowDAI contract
        await expect(cfDAIContract.setVault(deployerSigner.address)).to.be.revertedWith("Vault set")
        // Check if contract owner is contract deployer in both contracts
        expect(await cfDAIContract.owner()).to.equal(deployerSigner.address)
        expect(await dvlDAIContract.owner()).to.equal(deployerSigner.address)
        // Check if token details are correct in DAOVaultLowDAI contract
        expect(await dvlDAIContract.name()).to.equal("DAO Vault Low DAI")
        expect(await dvlDAIContract.symbol()).to.equal("dvlDAI")
        expect(await dvlDAIContract.decimals()).to.equal(18)
        // Check if all pre-set addresses are correct in DAOVaultLowDAI contract
        expect(await dvlDAIContract.token()).to.equal(tokenAddress)
        expect(await dvlDAIContract.strategy()).to.equal(cfDAIContract.address)
        expect(await dvlDAIContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
        // Check if other pre-set variables are correct in DAOVaultLowDAI contract
        expect(await dvlDAIContract.canSetPendingStrategy()).is.true
        expect(await dvlDAIContract.unlockTime()).to.equal(0)
        expect(await dvlDAIContract.LOCKTIME()).to.equal(2*24*60*60)
        // Check if token details are correct in CompoundFarmer contract
        expect(await cfDAIContract.name()).to.equal("Compound-Farmer DAI")
        expect(await cfDAIContract.symbol()).to.equal("cfDAI")
        expect(await cfDAIContract.decimals()).to.equal(18)
        // Check if all pre-set addresses are correct in CompoundFarmer contract
        expect(await cfDAIContract.token()).to.equal(tokenAddress)
        expect(await cfDAIContract.cToken()).to.equal(cTokenAddress)
        expect(await cfDAIContract.compToken()).to.equal(compTokenAddress)
        expect(await cfDAIContract.comptroller()).to.equal(comptrollerAddress)
        expect(await cfDAIContract.uniswapRouter()).to.equal(uniswapRouterAddress)
        expect(await cfDAIContract.DAOVault()).to.equal(dvlDAIContract.address)
        expect(await cfDAIContract.WETH()).to.equal(WETHAddress)
        expect(await cfDAIContract.treasuryWallet()).to.equal(treasuryWalletAddress)
        expect(await cfDAIContract.communityWallet()).to.equal(communityWalletAddress)
        // Check if all pre-set fees are correct in CompoundFarmer contract
        expect(await cfDAIContract.networkFeeTier2(0)).to.equal(decimals(50000).add(1))
        expect(await cfDAIContract.networkFeeTier2(1)).to.equal(decimals(100000))
        expect(await cfDAIContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("1", 24))
        expect(await cfDAIContract.DENOMINATOR()).to.equal("10000")
        expect(await cfDAIContract.networkFeePercentage(0)).to.equal("100")
        expect(await cfDAIContract.networkFeePercentage(1)).to.equal("75")
        expect(await cfDAIContract.networkFeePercentage(2)).to.equal("50")
        expect(await cfDAIContract.customNetworkFeePercentage()).to.equal("25")
        expect(await cfDAIContract.profileSharingFeePercentage()).to.equal("1000")
        expect(await cfDAIContract.treasuryFee()).to.equal("5000")
        expect(await cfDAIContract.communityFee()).to.equal("5000")
        // Check if all other pre-set variables are correct in CompoundFarmer contract
        expect(await cfDAIContract.isVesting()).is.false
        expect(await cfDAIContract.pool()).to.equal(0)
        expect(await cfDAIContract.amountOutMinPerc()).to.equal(9500)
        expect(await cfDAIContract.deadline()).to.equal(60*20) // 20 minutes
    })

    // Check user functions
    describe("User functions", () => {
        it("should able to deposit correctly", async () => {
            // Get deployer signer and deploy the contracts
            const { clientSigner, tokenContract, cfDAIContract, dvlDAIContract, sampleContract } = await setup()
            // Check if meet the function requirements
            let depositAmount = decimals("100")
            await tokenContract.transfer(clientSigner.address, depositAmount)
            await tokenContract.transfer(sampleContract.address, depositAmount)
            await tokenContract.connect(clientSigner).approve(cfDAIContract.address, depositAmount)
            await expect(dvlDAIContract.connect(clientSigner).deposit("0")).to.be.revertedWith("Amount must > 0")
            await expect(cfDAIContract.connect(clientSigner).deposit("100")).to.be.revertedWith("Only can call from Vault")
            await sampleContract.approve(cfDAIContract.address, depositAmount)
            await expect(sampleContract.deposit(depositAmount)).to.be.revertedWith("Only EOA")
            // Deposit token into contracts
            await dvlDAIContract.connect(clientSigner).deposit(depositAmount)
            // Check if amount of deposit is correct
            expect(await cfDAIContract.getCurrentBalance(clientSigner.address)).to.equal(decimals("100").mul(99).div(100)) // deposit fee 1%
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
            // Check if amount of shares token get is correct
            depositAmount = depositAmount.sub(depositAmount.mul(1).div(100))
            const shares = depositAmount.mul(await dvlDAIContract.totalSupply()).div(await cfDAIContract.pool())
            expect(await dvlDAIContract.balanceOf(clientSigner.address)).to.equal(shares)
            expect(await cfDAIContract.balanceOf(dvlDAIContract.address)).to.equal(shares)
            expect(await cfDAIContract.pool()).to.equal(depositAmount)
            expect(await cfDAIContract.totalSupply()).to.equal(shares)
            expect(await dvlDAIContract.totalSupply()).to.equal(shares)
        })

        it("should deduct correct network fee based on tier in CompoundFarmerDAI contract", async () => {
            const { deployerSigner, tokenContract, dvlDAIContract, cfDAIContract } = await setup()
            let treasuryBalance, communityBalance, depositBalance, fee
            treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            communityBalance = await tokenContract.balanceOf(communityWalletAddress)
            const depositTier1 = decimals(10000)
            const depositTier2 = decimals(100000)
            const depositTier3 = decimals(500000)
            const customDepositTier = decimals(1000000)
            await tokenContract.approve(cfDAIContract.address, depositTier1.add(depositTier2).add(depositTier3).add(customDepositTier))
            // Tier 1 deposit
            await dvlDAIContract.deposit(depositTier1)
            // Check deposit balance in contract and check fees receive by treasury and community wallet
            fee = depositTier1.mul(100).div(10000)
            expect(await cfDAIContract.getCurrentBalance(deployerSigner.address)).to.equal(depositTier1.sub(fee))
            depositBalance = depositTier1.sub(fee)
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryBalance.add(fee.mul(1).div(2)))
            treasuryBalance = treasuryBalance.add(fee.mul(1).div(2))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityBalance.add(fee.mul(1).div(2)))
            communityBalance = communityBalance.add(fee.mul(1).div(2))
            // Tier 2 deposit
            await dvlDAIContract.deposit(depositTier2)
            // Check deposit balance in contract and check fees receive by treasury and community wallet
            fee = depositTier2.mul(75).div(10000)
            expect(await cfDAIContract.getCurrentBalance(deployerSigner.address)).to.equal(depositBalance.add(depositTier2.sub(fee)))
            depositBalance = depositBalance.add(depositTier2.sub(fee))
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryBalance.add(fee.mul(1).div(2)))
            treasuryBalance = treasuryBalance.add(fee.mul(1).div(2))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityBalance.add(fee.mul(1).div(2)))
            communityBalance = communityBalance.add(fee.mul(1).div(2))
            // Tier 3 deposit
            await dvlDAIContract.deposit(depositTier3)
            // Check deposit balance in contract and check fees receive by treasury and community wallet
            fee = depositTier3.mul(50).div(10000)
            expect(await cfDAIContract.getCurrentBalance(deployerSigner.address)).to.equal(depositBalance.add(depositTier3.sub(fee)))
            depositBalance = depositBalance.add(depositTier3.sub(fee))
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryBalance.add(fee.mul(1).div(2)))
            treasuryBalance = treasuryBalance.add(fee.mul(1).div(2))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityBalance.add(fee.mul(1).div(2)))
            communityBalance = communityBalance.add(fee.mul(1).div(2))
            // Custom tier deposit
            await dvlDAIContract.deposit(customDepositTier)
            // Check deposit balance in contract and check fees receive by treasury and community wallet
            fee = customDepositTier.mul(25).div(10000)
            expect(await cfDAIContract.getCurrentBalance(deployerSigner.address)).to.equal(depositBalance.add(customDepositTier.sub(fee)))
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryBalance.add(fee.mul(1).div(2)))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityBalance.add(fee.mul(1).div(2)))
        })

        it("should be able to withdraw correctly", async () => {
            // Get deployer signer and deploy the contracts
            const { clientSigner, tokenContract, cTokenContract, cfDAIContract, dvlDAIContract } = await setup()
            // Deposit token into contracts
            const depositAmount = decimals(1000)
            // const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
            await tokenContract.transfer(clientSigner.address, depositAmount)
            await tokenContract.connect(clientSigner).approve(cfDAIContract.address, depositAmount)
            await dvlDAIContract.connect(clientSigner).deposit(depositAmount)
            // Check if meet the function requirements
            await expect(dvlDAIContract.connect(clientSigner).withdraw("0")).to.be.revertedWith("Amount must > 0")
            await expect(cfDAIContract.connect(clientSigner).withdraw(decimals(200))).to.be.revertedWith("Only can call from Vault")
            await expect(dvlDAIContract.withdraw(decimals(200))).to.be.revertedWith("Insufficient balance")
            // Withdraw all token from contracts
            const balance = await cfDAIContract.getCurrentBalance(clientSigner.address)
            // const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, deployerSigner)
            const underlyingBalance = await cTokenContract.balanceOfUnderlying(cfDAIContract.address)
            await dvlDAIContract.connect(clientSigner).withdraw(balance)
            // Check if amount of withdraw is correct
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(underlyingBalance) // Some token will be added in withdraw block
            expect(await dvlDAIContract.balanceOf(clientSigner.address)).to.equal(0)
            expect(await cfDAIContract.balanceOf(dvlDAIContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
        })

        it("should be able to withdraw in several times correctly", async() => {
            // Get deployer and client signer and deploy the contracts
            const { clientSigner, tokenContract, cTokenContract, compTokenContract, cfDAIContract, dvlDAIContract } = await setup()
            // Deposit token into contracts
            const depositAmount = decimals("1000")
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
            await tokenContract.transfer(clientSigner.address, depositAmount)
            await tokenContract.connect(clientSigner).approve(cfDAIContract.address, depositAmount)
            await dvlDAIContract.connect(clientSigner).deposit(depositAmount)
            // Get initial value before withdraw
            const depositBalanceBoforeWithdraw = await cfDAIContract.getCurrentBalance(clientSigner.address)
            const dvlTokenBalanceBeforeWithdraw = await dvlDAIContract.balanceOf(clientSigner.address)
            const cfTokenBalanceBeforeWithdraw = await cfDAIContract.balanceOf(dvlDAIContract.address)
            const cTokenBalanceBeforeWithdraw = await cTokenContract.balanceOf(cfDAIContract.address)
            const totalSupplyBeforeWithdraw = await cfDAIContract.totalSupply()
            const poolBalanceBeforeWithdraw = await cfDAIContract.pool()
            // Withdraw token from contracts 1st time
            let withdrawAmount = decimals("373")
            await dvlDAIContract.connect(clientSigner).withdraw(withdrawAmount)
            // Check if amount of withdraw is correct
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(withdrawAmount)
            expect(await dvlDAIContract.balanceOf(clientSigner.address)).to.equal(dvlTokenBalanceBeforeWithdraw.sub(withdrawAmount.mul(totalSupplyBeforeWithdraw).div(poolBalanceBeforeWithdraw)))
            expect(await cfDAIContract.balanceOf(dvlDAIContract.address)).to.equal(cfTokenBalanceBeforeWithdraw.sub(withdrawAmount.mul(totalSupplyBeforeWithdraw).div(poolBalanceBeforeWithdraw)))
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.equal(cTokenBalanceBeforeWithdraw.sub(cTokenBalanceBeforeWithdraw.mul(withdrawAmount).div(poolBalanceBeforeWithdraw)))
            expect(await compTokenContract.balanceOf(cfDAIContract.address)).to.be.gt(0)
            expect(await cfDAIContract.getCurrentBalance(clientSigner.address)).to.equal(depositBalanceBoforeWithdraw.sub(withdrawAmount))
            expect(await cfDAIContract.pool()).to.equal(poolBalanceBeforeWithdraw.sub(withdrawAmount))
            expect(await cfDAIContract.totalSupply()).to.equal(depositBalanceBoforeWithdraw.sub(withdrawAmount))
            expect(await dvlDAIContract.totalSupply()).to.equal(depositBalanceBoforeWithdraw.sub(withdrawAmount))
            // Withdraw token from contracts 2nd time
            underlyingBalance = await cTokenContract.balanceOfUnderlying(cfDAIContract.address)
            withdrawAmount = decimals("617")
            await dvlDAIContract.connect(clientSigner).withdraw(withdrawAmount)
            // Check if amount of withdraw is correct
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(underlyingBalance)
            expect(await dvlDAIContract.balanceOf(clientSigner.address)).to.equal(0)
            expect(await cfDAIContract.balanceOf(dvlDAIContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await cfDAIContract.getCurrentBalance(clientSigner.address)).to.equal(0)
            expect(await cfDAIContract.pool()).to.equal(0)
            expect(await cfDAIContract.totalSupply()).to.equal(0)
            expect(await dvlDAIContract.totalSupply()).to.equal(0)
        })

        it("should deduct correct profile sharing fee when withdraw in CompoundFarmerDAI contract", async () => {
            const { clientSigner, tokenContract, cfDAIContract, dvlDAIContract } = await setup()
            const treasuryWalletBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityWalletBalance = await tokenContract.balanceOf(communityWalletAddress)
            await tokenContract.transfer(clientSigner.address, decimals("1000"))
            // Deposit into contract
            await tokenContract.connect(clientSigner).approve(cfDAIContract.address, decimals("1000"))
            await dvlDAIContract.connect(clientSigner).deposit(decimals("1000"))
            const deployerBalance = await tokenContract.balanceOf(clientSigner.address)
            // Transfer some token to contract as profit
            await tokenContract.transfer(cfDAIContract.address, decimals("100"))
            const networkFee = decimals("1000").mul(1).div(100)
            const profileSharingFee = decimals("100").mul(1).div(10)
            const profit = decimals("100").sub(profileSharingFee)
            // Withdraw from contract and check if fee deduct correctly
            await dvlDAIContract.connect(clientSigner).withdraw(decimals("990"))
            expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(deployerBalance.add(decimals("990")).add(profit), decimals(1))
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.be.closeTo(treasuryWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), decimals(1))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.be.closeTo(communityWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), decimals(1))
        })

        it("should be able to mix and match deposit and withdraw correctly", async () => {
            const { deployerSigner, clientSigner, tokenContract, cfDAIContract, dvlDAIContract, cTokenContract, compTokenContract } = await setup()
            // Transfer some token to client
            await tokenContract.transfer(clientSigner.address, decimals("10000"))
            // Get data before deposit
            const deployerBalance = await tokenContract.balanceOf(deployerSigner.address)
            const clientBalance = await tokenContract.balanceOf(clientSigner.address)
            const treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityBalance = await tokenContract.balanceOf(communityWalletAddress)
            // Mix and match deposit and withdraw
            await tokenContract.approve(cfDAIContract.address, decimals("10000"))
            await tokenContract.connect(clientSigner).approve(cfDAIContract.address, decimals("10000"))
            await dvlDAIContract.deposit(decimals("1234"))
            await dvlDAIContract.connect(clientSigner).deposit(decimals("3210"))
            await dvlDAIContract.deposit(decimals("2345"))
            await dvlDAIContract.connect(clientSigner).withdraw(decimals("2020"))
            await dvlDAIContract.withdraw(decimals("1989"))
            await dvlDAIContract.connect(clientSigner).deposit(decimals("378"))
            await dvlDAIContract.connect(clientSigner).withdraw("1532120000000000000000")
            await dvlDAIContract.withdraw("1554210000000000000000")
            // Check if final number is correct
            expect(await cfDAIContract.pool()).to.equal(0)
            expect(await cfDAIContract.getCurrentBalance(deployerSigner.address)).to.equal(0)
            expect(await cfDAIContract.getCurrentBalance(clientSigner.address)).to.equal(0)
            expect(await cfDAIContract.totalSupply()).to.equal(0)
            expect(await cfDAIContract.balanceOf(dvlDAIContract.address)).to.equal(0)
            expect(await dvlDAIContract.totalSupply()).to.equal(0)
            expect(await dvlDAIContract.balanceOf(deployerSigner.address)).to.equal(0)
            expect(await dvlDAIContract.balanceOf(clientSigner.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOfUnderlying(cfDAIContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.gte(deployerBalance.sub("35790000000000000000"))
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(clientBalance.sub("35880000000000000000"))
            // Check if treasury and community wallet receive fees correctly
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryBalance.add("35835000000000000000"))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityBalance)
        })

        it("should be able to refund correctly when contract is in vesting state", async () => {
            const { deployerSigner, clientSigner , tokenContract, cTokenContract, compTokenContract, cfDAIContract, dvlDAIContract } = await setup()
            // Deposit into contract and check if all parameter is correct
            const depositAmount = decimals("1000")
            await tokenContract.approve(cfDAIContract.address, depositAmount)
            await dvlDAIContract.deposit(depositAmount)
            await tokenContract.transfer(clientSigner.address, depositAmount)
            await tokenContract.connect(clientSigner).approve(cfDAIContract.address, depositAmount)
            await dvlDAIContract.connect(clientSigner).deposit(depositAmount)
            const depositBalance = await cfDAIContract.getCurrentBalance(deployerSigner.address)
            const treasuryBalanceBeforeVesting = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityBalanceBeforeVesting = await tokenContract.balanceOf(communityWalletAddress)
            expect(await dvlDAIContract.balanceOf(deployerSigner.address)).to.equal(decimals(990))
            expect(await dvlDAIContract.balanceOf(clientSigner.address)).to.equal(decimals(990))
            expect(await cfDAIContract.balanceOf(dvlDAIContract.address)).to.equal(decimals(1980))
            expect(await cfDAIContract.totalSupply()).to.equal(decimals(1980))
            expect(await dvlDAIContract.totalSupply()).to.equal(decimals(1980))
            expect(await cfDAIContract.pool()).to.equal(decimals(1980))
            expect(await tokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.gt(0)
            expect(await compTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            // Vesting the contract
            await cfDAIContract.vesting()
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryBalanceBeforeVesting)
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityBalanceBeforeVesting)
            const refundBalance = await cfDAIContract.getCurrentBalance(deployerSigner.address)
            expect(refundBalance).to.gte(depositBalance)
            expect(await cfDAIContract.pool()).to.gt(decimals(1980))
            expect(await tokenContract.balanceOf(cfDAIContract.address)).to.gt(decimals(1980))
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            // Refund from vesting contract
            await dvlDAIContract.connect(clientSigner).refund()
            await dvlDAIContract.refund()
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.gte(depositBalance.mul(1).div(100))
            expect(await dvlDAIContract.balanceOf(deployerSigner.address)).to.equal(0)
            expect(await cfDAIContract.balanceOf(dvlDAIContract.address)).to.equal(0)
            expect(await cfDAIContract.totalSupply()).to.equal(0)
            expect(await dvlDAIContract.totalSupply()).to.equal(0)
            expect(await cfDAIContract.pool()).to.equal(0)
            expect(await tokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
        })

        it("should deduct correct profile sharing fee when vesting in CompoundFarmerDAI contract", async () => {
            const { clientSigner, tokenContract, cfDAIContract, dvlDAIContract } = await setup()
            const treasuryWalletBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityWalletBalance = await tokenContract.balanceOf(communityWalletAddress)
            await tokenContract.transfer(clientSigner.address, decimals(1000))
            // Deposit into contract
            await tokenContract.connect(clientSigner).approve(cfDAIContract.address, decimals(1000))
            await dvlDAIContract.connect(clientSigner).deposit(decimals(1000))
            const deployerBalance = await tokenContract.balanceOf(clientSigner.address)
            // Transfer some token to contract as profit
            await tokenContract.transfer(cfDAIContract.address, decimals(100))
            const networkFee = decimals(1000).mul(1).div(100)
            const profileSharingFee = decimals(100).mul(1).div(10)
            const profit = decimals(100).sub(profileSharingFee)
            // Vesting contract and check if fee deduct correctly
            await cfDAIContract.vesting()
            await dvlDAIContract.connect(clientSigner).refund()
            expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(deployerBalance.add(decimals(990)).add(profit), decimals(1))
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.be.closeTo(treasuryWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), decimals(1))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.be.closeTo(communityWalletBalance.add(networkFee.mul(1).div(2)).add(profileSharingFee.mul(1).div(2)), decimals(1))
        })
    })

    // Test admin functions
    describe("Admin functions", () => {
        it("should able to transfer contract ownership to other address by contract owner only in both contracts", async () => {
            const { deployerSigner, clientSigner, cfDAIContract, dvlDAIContract } = await setup()
            // Check if contract ownership is owner before transfer
            expect(await cfDAIContract.owner()).to.equal(deployerSigner.address)
            expect(await dvlDAIContract.owner()).to.equal(deployerSigner.address)
            // Check if new owner cannot execute admin functions yet
            await expect(dvlDAIContract.connect(clientSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlDAIContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlDAIContract.connect(clientSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setNetworkFeeTier2([decimals(100), decimals(200)])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setCustomNetworkFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setProfileSharingFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setAmountOutMinPerc(9000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setDeadline(12000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).approveMigrate()).to.be.revertedWith("Ownable: caller is not the owner")
            // Transfer contract ownership from owner to new owner
            await dvlDAIContract.connect(deployerSigner).transferOwnership(clientSigner.address)
            await cfDAIContract.connect(deployerSigner).transferOwnership(clientSigner.address)
            // Check if contract ownership is new owner after transfer
            expect(await dvlDAIContract.owner()).to.equal(clientSigner.address)
            expect(await cfDAIContract.owner()).to.equal(clientSigner.address)
            // Check if new owner can execute admin function
            await expect(dvlDAIContract.connect(clientSigner).unlockMigrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlDAIContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlDAIContract.connect(clientSigner).migrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setCommunityWallet(clientSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setNetworkFeeTier2([decimals(100), decimals(200)])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setCustomNetworkFeePercentage(3000)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setProfileSharingFeePercentage(3000)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setAmountOutMinPerc(9000)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).setDeadline(12000)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).vesting()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(clientSigner).approveMigrate()).not.to.be.revertedWith("Ownable: caller is not the owner")
            // Check if original owner neither can execute admin function nor transfer back ownership
            await expect(dvlDAIContract.connect(deployerSigner).transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlDAIContract.connect(deployerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlDAIContract.connect(deployerSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvlDAIContract.connect(deployerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).setCommunityWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).setNetworkFeeTier2([decimals(100), decimals(200)])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).setNetworkFeePercentage([3000, 3000, 3000])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 12))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).setCustomNetworkFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).setProfileSharingFeePercentage(3000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).setAmountOutMinPerc(9000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).setDeadline(12000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(cfDAIContract.connect(deployerSigner).approveMigrate()).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("should able to set new treasury wallet correctly in CompoundFarmerDAI contract", async () => {
            const { clientSigner, tokenContract, cfDAIContract, dvlDAIContract } = await setup()
            // Set new treasury wallet and check if event for setTreasuryWallet function is logged
            await expect(cfDAIContract.setTreasuryWallet(clientSigner.address))
                .to.emit(cfDAIContract, "SetTreasuryWallet")
                .withArgs(treasuryWalletAddress, clientSigner.address)
            // Check if new treasury wallet is set to the contract
            expect(await cfDAIContract.treasuryWallet()).to.equal(clientSigner.address)
            // Check if new treasury wallet receive fees
            await tokenContract.approve(cfDAIContract.address, decimals(1000))
            await dvlDAIContract.deposit(decimals(200))
            // Deposit amount within network fee tier 1 hence fee = 0.5%
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(decimals(1))
        })

        it("should able to set new community wallet correctly in CompoundFarmerDAI contract", async () => {
            const { clientSigner, tokenContract, cfDAIContract, dvlDAIContract } = await setup()
            // Set new community wallet and check if event for setCommunityWallet function is logged
            await expect(cfDAIContract.setCommunityWallet(clientSigner.address))
                .to.emit(cfDAIContract, "SetCommunityWallet")
                .withArgs(communityWalletAddress, clientSigner.address)
            // Check if new community wallet is set to the contract
            expect(await cfDAIContract.communityWallet()).to.equal(clientSigner.address)
            // Check if new treasury wallet receive fees
            await tokenContract.approve(cfDAIContract.address, decimals(1000))
            await dvlDAIContract.deposit(decimals(200))
            // Deposit amount within network fee tier 1 hence fee = 0.5%
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(decimals(1))
        })

        it("should able to set new network fee tier correctly in CompoundFarmerDAI contract", async () => {
            const { cfDAIContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfDAIContract.setNetworkFeeTier2([0, decimals(10000)]))
                .to.be.revertedWith("Minimun amount cannot be 0")
            await expect(cfDAIContract.setNetworkFeeTier2([decimals(10000), decimals(10000)]))
                .to.be.revertedWith("Maximun amount must greater than minimun amount")
            // Set new network fee tier 2 and check if event for setNetworkFeeTier2 is logged
            await expect(cfDAIContract.setNetworkFeeTier2([decimals(60000).add(1), decimals(600000)]))
                .to.emit(cfDAIContract, "SetNetworkFeeTier2")
                .withArgs([(decimals(50000).add(1).toString()).toString(), decimals(100000).toString()], [(decimals(60000).add(1)).toString(), decimals(600000).toString()])
            // Check if network fee tier 2 amount is set correctly
            expect(await cfDAIContract.networkFeeTier2(0)).to.equal(decimals(60000).add(1))
            expect(await cfDAIContract.networkFeeTier2(1)).to.equal(decimals(600000))
        })

        it("should able to set new custom network fee tier correctly in CompoundFarmerDAI contract", async () => {
            const { cfDAIContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfDAIContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 22)))
                .to.be.revertedWith("Custom network fee tier must greater than tier 2")
            // Set new custom network fee tier and check if event for setCustomNetworkFeeTier is logged
            await expect(cfDAIContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("2", 24)))
                .to.emit(cfDAIContract, "SetCustomNetworkFeeTier")
                .withArgs(ethers.utils.parseUnits("1", 24).toString(), ethers.utils.parseUnits("2", 24).toString())
            // Check if custom network fee tier amount is set correctly
            expect(await cfDAIContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("2", 24))
        })

        it("should able to set new network fee percentage correctly in CompoundFarmerDAI contract", async () => {
            const { cfDAIContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfDAIContract.setNetworkFeePercentage([3000, 0, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 30%")
            await expect(cfDAIContract.setNetworkFeePercentage([0, 3000, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 30%")
            await expect(cfDAIContract.setNetworkFeePercentage([0, 0, 3000]))
                .to.be.revertedWith("Network fee percentage cannot be more than 30%")
            // Set network fee percentage and check if event for setNetworkFeePercentage is logged
            await expect(cfDAIContract.setNetworkFeePercentage([200, 100, 50]))
                .to.emit(cfDAIContract, "SetNetworkFeePercentage")
                .withArgs([100, 75, 50], [200, 100, 50])
            // Check if network fee percentage is set correctly
            expect(await cfDAIContract.networkFeePercentage(0)).to.equal(200)
            expect(await cfDAIContract.networkFeePercentage(1)).to.equal(100)
            expect(await cfDAIContract.networkFeePercentage(2)).to.equal(50)
        })

        it("should able to set new custom network fee percentage correctly in CompoundFarmerDAI contract", async () => {
            const { cfDAIContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfDAIContract.setCustomNetworkFeePercentage(60))
                .to.be.revertedWith("Custom network fee percentage cannot be more than tier 2")
            // Set custom network fee percentage and check if event for setCustomNetworkFeePercentage is logged
            await expect(cfDAIContract.setCustomNetworkFeePercentage(10))
                .to.emit(cfDAIContract, "SetCustomNetworkFeePercentage")
                .withArgs(25, 10)
            // Check if network fee percentage is set correctly
            expect(await cfDAIContract.customNetworkFeePercentage()).to.equal(10)
        })

        it("should able to set new profile sharing fee percentage correctly in CompoundFarmerDAI contract", async () => {
            const { cfDAIContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(cfDAIContract.setProfileSharingFeePercentage(3000))
                .to.be.revertedWith("Profile sharing fee percentage cannot be more than 30%")
            // Set profile sharing fee percentage and check if event for setProfileSharingFeePercentage is logged
            await expect(cfDAIContract.setProfileSharingFeePercentage(2000))
                .to.emit(cfDAIContract, "SetProfileSharingFeePercentage")
                .withArgs(1000, 2000)
            // Check if profile sharing fee percentage is set correctly
            expect(await cfDAIContract.profileSharingFeePercentage()).to.equal(2000)
        })

        it("should set amount out minimum percentage on Uniswap swap function correctly in CompoundFarmerDAI contract", async () => {
            const { cfDAIContract } = await setup()
            // Check if meet the requirements
            await expect(cfDAIContract.setAmountOutMinPerc(9900)).to.be.revertedWith("Amount out minimun > 97%")
            // Set new amount out minimum percentage
            await cfDAIContract.setAmountOutMinPerc(8000)
            // Check if new amount out minimum percentage set correctly
            expect(await cfDAIContract.amountOutMinPerc()).to.equal(8000)
        })

        it("should set deadline on Uniswap swap function correctly in CompoundFarmerDAI contract", async () => {
            const { cfDAIContract } = await setup()
            // Check if meet the requirements
            await expect(cfDAIContract.setDeadline(1)).to.be.revertedWith("Deadline < 60 seconds")
            // Check if able to set new deadline
            await cfDAIContract.setDeadline(300)
            // Check if new amount out minimum percentage set correctly
            expect(await cfDAIContract.deadline()).to.equal(300)
        })

        it("should able to set pending strategy, migrate funds and set new strategy correctly in DAOVaultLowDAI contract", async () => {
            const { deployerSigner, tokenContract, cfDAIContract, dvlDAIContract } = await setup()
            // Set pending strategy
            const sampleContract_JSON = require("../build/SampleContract.json")
            const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvlDAIContract.address, tokenContract.address])
            await dvlDAIContract.setPendingStrategy(sampleContract.address)
            // Check if pending strategy is set with given address
            expect(await dvlDAIContract.pendingStrategy()).to.equal(sampleContract.address)
            // Deposit into daoVaultDAI and execute vesting function
            await tokenContract.approve(cfDAIContract.address, decimals(100000))
            await dvlDAIContract.deposit(decimals(100000))
            await cfDAIContract.vesting()
            // Get Yearn Farmer token balance before migrate
            const tokenBalance = await tokenContract.balanceOf(cfDAIContract.address)
            // Execute unlock migrate funds function
            await dvlDAIContract.unlockMigrateFunds()
            // Check if execute migrate funds function before 2 days or after 3 days be reverted
            network.provider.send("evm_increaseTime", [86400]) // advance for 1 day
            await expect(dvlDAIContract.migrateFunds()).to.be.revertedWith("Function locked")
            network.provider.send("evm_increaseTime", [86400*2+60]) // advance for another 2 days
            await expect(dvlDAIContract.migrateFunds()).to.be.revertedWith("Function locked")
            // Execute unlock migrate funds function again
            await dvlDAIContract.unlockMigrateFunds()
            network.provider.send("evm_increaseTime", [86400*2]) // advance for 2 days
            // Approve for token transfer from Yearn Farmer to new strategy
            await cfDAIContract.approveMigrate()
            // Check if migrate funds function meet the requirements
            // Need to comment out deposit() function and all code below this to test this
            // await expect(dvlDAIContract.migrateFunds()).to.be.revertedWith("No balance to migrate")
            // Need to comment out set/check pending strategy function and all code below this to test this
            // await expect(dvlDAIContract.migrateFunds()).to.be.revertedWith("No pendingStrategy")
            // Execute migrate funds function and check if event for migrateFunds is logged
            await expect(dvlDAIContract.migrateFunds()).to.emit(dvlDAIContract, "MigrateFunds")
                .withArgs(cfDAIContract.address, sampleContract.address, tokenBalance)
            // Check if token transfer correctly
            expect(await tokenContract.balanceOf(sampleContract.address)).to.equal(tokenBalance)
            expect(await tokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            // Check if cfDAI in daoVaultDAI burn to 0
            expect(await cfDAIContract.balanceOf(dvlDAIContract.address)).to.equal(0)
            // Check if new strategy set and pending strategy reset to 0
            expect(await dvlDAIContract.strategy()).to.equal(sampleContract.address)
            expect(await dvlDAIContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
            // Check if execute migrate funds function again be reverted
            await expect(dvlDAIContract.migrateFunds()).to.be.revertedWith("Function locked")
        })

        it("should set contract in vesting state correctly in CompoundFarmerDAI contract", async () => {
            const { deployerSigner, tokenContract, cTokenContract, compTokenContract, cfDAIContract, dvlDAIContract } = await setup()
            const treasuryBalance = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityBalance = await tokenContract.balanceOf(communityWalletAddress)
            // Deposit into CompoundFarmerDAI through daoVaultDAI
            await tokenContract.approve(cfDAIContract.address, decimals(10000))
            await dvlDAIContract.deposit(decimals(500))
            await dvlDAIContract.deposit(decimals(500))
            const depositAmount = await cfDAIContract.getCurrentBalance(deployerSigner.address)
            expect(depositAmount).to.equal(decimals(990))
            const poolAmount = await cfDAIContract.pool()
            expect(poolAmount).to.equal(decimals(990))
            // Check if corresponding function to be reverted if no vesting
            await expect(dvlDAIContract.refund()).to.be.revertedWith("Not in vesting state")
            await expect(cfDAIContract.revertVesting()).to.be.revertedWith("Not in vesting state")
            await expect(cfDAIContract.approveMigrate()).to.be.revertedWith("Not in vesting state")
            // Vesting the contract
            await cfDAIContract.vesting()
            // Check if vesting state change to true
            expect(await cfDAIContract.isVesting()).is.true
            // Check if corresponding function to be reverted in vesting state
            await expect(dvlDAIContract.deposit(decimals(500))).to.be.revertedWith("Contract in vesting state")
            await expect(dvlDAIContract.withdraw(decimals(500))).to.be.revertedWith("Contract in vesting state")
            // Check if deployer balance in contract after vesting greater than deposit amount(because of profit)
            const deployerBalanceAfterVesting = await cfDAIContract.getCurrentBalance(deployerSigner.address)
            expect(deployerBalanceAfterVesting).to.gt(depositAmount)
            // Check if pool amount greater than amount before vesting after vesting state
            const poolAmountAfterVesting = await cfDAIContract.pool()
            expect(poolAmountAfterVesting).to.gt(poolAmount)
            // Check if deployer balance in contract == total token balance in contract == pool
            expect(deployerBalanceAfterVesting).to.equal(await tokenContract.balanceOf(cfDAIContract.address))
            expect(deployerBalanceAfterVesting).to.equal(poolAmountAfterVesting)
            // Check if amount of cToken and compToken is correct
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            // Check if execute vesting function again to be reverted
            await expect(cfDAIContract.vesting()).to.be.revertedWith("Already in vesting state")
            // Check if amount fee transfer to treasury and community wallet correctly (50% split)
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gt(treasuryBalance.add(ethers.utils.parseUnits("25", 17)))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.gt(communityBalance.add(ethers.utils.parseUnits("25", 17)))
        })

        it("should revert contract vesting state and lend into Compound again correctly", async () => {
            const { clientSigner, tokenContract, cTokenContract, compTokenContract, dvlDAIContract, cfDAIContract } = await setup()
            // Deposit token
            await tokenContract.transfer(clientSigner.address, decimals("2000"))
            await tokenContract.connect(clientSigner).approve(cfDAIContract.address, decimals("2000"))
            await dvlDAIContract.connect(clientSigner).deposit(decimals("1000"))
            expect(await tokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            const cTokenBalance = await cTokenContract.balanceOf(cfDAIContract.address)
            // Vesting contract
            await cfDAIContract.vesting()
            expect(await tokenContract.balanceOf(cfDAIContract.address)).to.gt(decimals("990"))
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            // Revert vesting contract
            await cfDAIContract.revertVesting()
            // Check if vesting state change to false
            expect(await cfDAIContract.isVesting()).is.false
            // Check if everything goes normal after revert vesting and lend into Compound again
            expect(await tokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.be.closeTo(cTokenBalance, 200000)
            let clientBalance = await cfDAIContract.getCurrentBalance(clientSigner.address)
            expect(clientBalance).to.gt(decimals("990"))
            await dvlDAIContract.connect(clientSigner).deposit(decimals("1000"))
            clientBalance = clientBalance.add(decimals("990"))
            await dvlDAIContract.connect(clientSigner).withdraw(clientBalance)
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gt(clientBalance)
            expect(await dvlDAIContract.balanceOf(clientSigner.address)).to.equal(0)
            expect(await cfDAIContract.balanceOf(dvlDAIContract.address)).to.equal(0)
            expect(await dvlDAIContract.totalSupply()).to.equal(0)
            expect(await cTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await compTokenContract.balanceOf(cfDAIContract.address)).to.equal(0)
            expect(await cfDAIContract.totalSupply()).to.equal(0)
            expect(await cfDAIContract.pool()).to.equal(0)
        })
    })
})