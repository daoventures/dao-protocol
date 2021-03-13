const { expect } = require("chai")
const { ethers, network, deployments } = require("hardhat")
const { mainnet: network_ } = require("../addresses")
require("dotenv").config()
const IERC20_ABI = require("../abis/IERC20_ABI.json")
const ICERC20_ABI = require("../abis/CTOKEN_ABI.json")
const ICOMPERC20_ABI = require("../abis/COMP_ABI.json")
const ICOMPTROLLER_ABI = require("../abis/COMPTROLLER_ABI.json")

const treasuryWalletAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
const communityWalletAddress = "0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0"

const decimals = (amount) => {
    return ethers.utils.parseUnits(amount.toString(), 6) // Change this to meet token decimals
}

describe("cfUSDT", () => {

    const tokenContracts = async () => {
        const [deployerSigner, clientSigner] = await ethers.getSigners()
        const tokenContract = new ethers.Contract(network_.USDT.tokenAddress, IERC20_ABI, deployerSigner)
        const cTokenContract = new ethers.Contract(network_.USDT.cTokenAddress, ICERC20_ABI, deployerSigner)
        const compTokenContract = new ethers.Contract(network_.USDT.compTokenAddress, ICOMPERC20_ABI, deployerSigner)

        return { deployerSigner, clientSigner , tokenContract, cTokenContract, compTokenContract }
    }

    beforeEach(async () => {
        await deployments.fixture(["hardhat"])
    })

    // it("should deploy contract correctly", async () => {
    //     // Get deployer signer and deploy the contracts
    //     // const [deployerSigner, _] = await ethers.getSigners()
    //     const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT")
    //     const dvlUSDTContract = await ethers.getContract("DAOVaultLowUSDT")
    //     const { deployerSigner } = await tokenContracts()
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
    //     expect(await dvlUSDTContract.token()).to.equal(network_.USDT.tokenAddress)
    //     expect(await dvlUSDTContract.strategy()).to.equal(cfUSDTContract.address)
    //     expect(await dvlUSDTContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
    //     // Check if other pre-set variables are correct in DAOVaultLowUSDT contract
    //     expect(await dvlUSDTContract.canSetPendingStrategy()).is.true
    //     expect(await dvlUSDTContract.unlockTime()).to.equal(0)
    //     expect(await dvlUSDTContract.LOCKTIME()).to.equal(5*24*60*60)
    //     // Check if token details are correct in Compound-Farmer contract
    //     expect(await cfUSDTContract.name()).to.equal("Compound-Farmer USDT")
    //     expect(await cfUSDTContract.symbol()).to.equal("cfUSDT")
    //     expect(await cfUSDTContract.decimals()).to.equal(6)
    //     // Check if all pre-set addresses are correct in Compound-Farmer contract
    //     expect(await cfUSDTContract.token()).to.equal(network_.USDT.tokenAddress)
    //     expect(await cfUSDTContract.cToken()).to.equal(network_.USDT.cTokenAddress)
    //     expect(await cfUSDTContract.compToken()).to.equal(network_.USDT.compTokenAddress)
    //     expect(await cfUSDTContract.comptroller()).to.equal(network_.USDT.comptrollerAddress)
    //     expect(await cfUSDTContract.uniswapRouter()).to.equal(network_.USDT.uniswapRouterAddress)
    //     expect(await cfUSDTContract.DAOVault()).to.equal(dvlUSDTContract.address)
    //     expect(await cfUSDTContract.WETH()).to.equal(network_.USDT.WETHAddress)
    //     expect(await cfUSDTContract.treasuryWallet()).to.equal(treasuryWalletAddress)
    //     expect(await cfUSDTContract.communityWallet()).to.equal(communityWalletAddress)
    //     // Check if all pre-set fees are correct in Compound-Farmer contract
    //     expect(await cfUSDTContract.depositFeeTier2(0)).to.equal("10000000001")
    //     expect(await cfUSDTContract.depositFeeTier2(1)).to.equal("100000000000")
    //     expect(await cfUSDTContract.DENOMINATOR()).to.equal("10000")
    //     expect(await cfUSDTContract.depositFee(0)).to.equal("100")
    //     expect(await cfUSDTContract.depositFee(1)).to.equal("50")
    //     expect(await cfUSDTContract.depositFee(2)).to.equal("25")
    //     expect(await cfUSDTContract.profileSharingFee()).to.equal("1000")
    //     expect(await cfUSDTContract.treasuryAndCommunityFee()).to.equal("5000")
    //     // Check if all other pre-set variables are correct in Compound-Farmer contract
    //     expect(await cfUSDTContract.isVesting()).is.false
    //     expect(await cfUSDTContract.pool()).to.equal(0)
    // })

    // Check user functions
    describe("User functions", () => {
        // it("should able to deposit correctly", async () => {
        //     // Get deployer signer and deploy the contracts
        //     // const [deployerSigner, clientSigner, _] = await ethers.getSigners()
        //     const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT")
        //     const dvlUSDTContract = await ethers.getContract("DAOVaultLowUSDT")
        //     const { clientSigner, tokenContract} = await tokenContracts()
        //     // Check if meet the function requirements
        //     let depositAmount = decimals("100")
        //     // const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        //     await tokenContract.transfer(clientSigner.address, depositAmount)
        //     await tokenContract.connect(clientSigner).approve(cfUSDTContract.address, depositAmount)
        //     await expect(dvlUSDTContract.connect(clientSigner).deposit("0")).to.be.revertedWith("Amount must > 0")
        //     await expect(cfUSDTContract.connect(clientSigner).deposit("100")).to.be.revertedWith("Only can call from Vault")
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
        //     // const [deployerSigner, clientSigner, _] = await ethers.getSigners()
        //     const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT")
        //     const dvlUSDTContract = await ethers.getContract("DAOVaultLowUSDT")
        //     const { clientSigner, tokenContract, cTokenContract } = await tokenContracts()
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
        //     const [deployerSigner, clientSigner, _] = await ethers.getSigners()
        //     const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT", deployerSigner)
        //     const dvlUSDTContract = await ethers.getContract("DAOVaultLowUSDT", deployerSigner)
        //     const { tokenContract, cTokenContract, compTokenContract } = await tokenContracts()
        //     // Deposit token into contracts
        //     const depositAmount = decimals("1000")
        //     // const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(0)
        //     await tokenContract.transfer(clientSigner.address, depositAmount)
        //     await tokenContract.connect(clientSigner).approve(cfUSDTContract.address, depositAmount)
        //     await dvlUSDTContract.connect(clientSigner).deposit(depositAmount)
        //     // Get initial value before withdraw
        //     // const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, deployerSigner)
        //     // const compTokenContract = new ethers.Contract(COMPAddress, ICOMPERC20_ABI, deployerSigner)
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
        //     // Get deployer and client signer and deploy the contracts
        //     const [deployerSigner, clientSigner, _] = await ethers.getSigners()
        //     const cfUSDTContract = await ethers.getContract("CompoundFarmerUSDT")
        //     const dvlUSDTContract = await ethers.getContract("DAOVaultLowUSDT")
        //     // Transfer some token to client
        //     // const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        //     const { tokenContract } = await tokenContracts()
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
        //     const cTokenContract = new ethers.Contract(network_.USDT.cTokenAddress, ICERC20_ABI, deployerSigner)
        //     expect(await cTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await cTokenContract.balanceOfUnderlying(cfUSDTContract.address)).to.equal(0)
        //     const compTokenContract = new ethers.Contract(network_.USDT.compTokenAddress, ICOMPERC20_ABI, deployerSigner)
        //     expect(await compTokenContract.balanceOf(cfUSDTContract.address)).to.equal(0)
        //     expect(await tokenContract.balanceOf(deployerSigner.address)).to.gte(deployerBalance.sub("35790000"))
        //     expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(clientBalance.sub("35880000"))
        //     // Check if treasury and community wallet receive fees correctly
        //     expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryBalance.add("71670000"))
        //     expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityBalance)
        // })

        it("should be able to refund correctly when contract is in vesting state", async () => {

        })
    })

    // it("should work", async () => {
    //     // Get deployer signer and deploy the contracts
    //     const [deployerSigner, _] = await ethers.getSigners()
    //     const CfUSDTContract = await ethers.getContractFactory("CompoundFarmerUSDT", deployerSigner)
    //     const cfUSDTContract = await CfUSDTContract.deploy()
    //     const DvlUSDTContract = await ethers.getContractFactory("DAOVaultLowUSDT", deployerSigner)
    //     const dvlUSDTContract = await DvlUSDTContract.deploy(tokenAddress, cfUSDTContract.address)
        // await cfUSDTContract.setVault(dvlUSDTContract.address)

        // const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        // const amount = decimals("1000")
        // await tokenContract.approve(cfUSDTContract.address, amount)
        // await dvlUSDTContract.deposit(amount)
        // console.log((await tokenContract.balanceOf(deployerSigner.address)).toString())

        // const dvlUSDTTokenAmount = dvlUSDTContract.balanceOf(deployerSigner.address)

        // const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, deployerSigner)
        // console.log((await cTokenContract.balanceOfUnderlying(cfUSDTContract.address)).toString())
        // const cTokenAmount = await cTokenContract.balanceOf(cfUSDTContract.address)
        // console.log((await cTokenContract.balanceOf(cfUSDTContract.address)).toString())

        // const COMPContract = new ethers.Contract(COMPAddress, ICOMPERC20_ABI, deployerSigner)
        // console.log((await tokenContract.balanceOf(cfUSDTContract.address)).toString())

        // await network.provider.request({
        //     method: "hardhat_impersonateAccount",
        //     params: [unlockedCOMPWalletAddress]
        // })
        // const unlockedCOMPSigner = await ethers.provider.getSigner(unlockedCOMPWalletAddress)
        // await COMPContract.connect(unlockedCOMPSigner).transfer(cfUSDTContract.address, ethers.utils.parseUnits("1", 17))

        // await dvlUSDTContract.withdraw(dvlUSDTTokenAmount)
        // const tokenAmount = await tokenContract.balanceOf(deployerSigner.address)
        // console.log(ethers.utils.formatUnits(tokenAmount, 6))
        // // console.log((await cTokenContract.balanceOf(cfUSDTContract.address)).toString())

        // const unlockedcUSDTWalletAddress = "0x2bddEd18E2CA464355091266B7616956944ee7eE"
        // await network.provider.request({
        //     method: "hardhat_impersonateAccount",
        //     params: [unlockedcUSDTWalletAddress]
        // })
        // const unlockedcUSDTSigner = await ethers.provider.getSigner(unlockedcUSDTWalletAddress)
        // const COMPContract = new ethers.Contract(COMPAddress, ICOMPERC20_ABI, deployerSigner)
        // const comptrollerContract = new ethers.Contract(comptrollerAddress, ICOMPTROLLER_ABI, deployerSigner)
        // // console.log((await comptrollerContract.compRate()).toString())
        // console.log(ethers.utils.formatUnits(await tokenContract.balanceOf(unlockedcUSDTWalletAddress), 6))
        // console.log(ethers.utils.formatUnits(await cTokenContract.balanceOf(unlockedcUSDTWalletAddress), 8))
        // console.log(ethers.utils.formatUnits(await COMPContract.balanceOf(unlockedcUSDTWalletAddress), 18))
        // await comptrollerContract.claimComp(unlockedcUSDTWalletAddress, [cTokenAddress])
        // await cTokenContract.connect(unlockedcUSDTSigner).redeem(await cTokenContract.balanceOf(unlockedcUSDTWalletAddress))
        // console.log()
        // console.log(ethers.utils.formatUnits(await tokenContract.balanceOf(unlockedcUSDTWalletAddress), 6))
        // console.log(ethers.utils.formatUnits(await cTokenContract.balanceOf(unlockedcUSDTWalletAddress), 8))
        // console.log(ethers.utils.formatUnits(await COMPContract.balanceOf(unlockedcUSDTWalletAddress), 18))

        // const provider = ethers.provider
        // const cTokenContract = new ethers.Contract(cTokenAddress, ICERC20_ABI, provider)
        // let compoundAPR = (await cTokenContract.supplyRatePerBlock()).mul("2102400")
        // let compoundAPR = (await cfUSDTContract.getBaseAPR())
        // compoundAPR = ethers.utils.formatUnits(compoundAPR, 16)
        // console.log(`APR: ${compoundAPR.slice(0, 4)}%`)
    // })
})