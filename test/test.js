const { ethers, upgrades, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")
const vaultABI = require("../abis/vaultABI.json")

const unlockedAddr = "0x28C6c06298d514Db089934071355E5743bf21d60"
const ownerAddr = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
const oldUserAddr = "0x0A0949Ad4ebDBAf6434C66761FD32235A6Ca76A7"

const USDTAddr = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const TUSDAddr = "0x0000000000085d4780B73119b644AE5ecd22b376"

const USDTVaultAddr = "0x4F0C1c9bA6B9CCd0BEd6166e86b672ac8EE621F7"
const USDCVaultAddr = "0x9f0230FbDC0379E5FefAcca89bE03A42Fec5fb6E"
const DAIVaultAddr = "0x2bFc2Da293C911e5FfeC4D2A2946A599Bc4Ae770"
const TUSDVaultAddr = "0x2C8de02aD4312069355B94Fb936EFE6CFE0C8FF6"

const USDTStrategyAddr = "0x3DB93e95c9881BC7D9f2C845ce12e97130Ebf5f2"
const USDCStrategyAddr = "0x4A9dE4dA5eC67E1dbc8e18F26E178B40D690A11D"
const DAIStrategyAddr = "0x3685fB7CA1C555Cb5BD5A246422ee1f2c53DdB71"
const TUSDStrategyAddr = "0xA6F1409a259B21a84c8346ED1B0826D656959a54"

describe("Yearn Strategy", () => {
    it("should work", async () => {
        const [deployer, client, treasury, community, strategist, admin] = await ethers.getSigners()
        
        const YearnStrategy = await ethers.getContractFactory("YearnStrategy", deployer)
        const yearnStrategy = await upgrades.deployProxy(YearnStrategy, [
            treasury.address, community.address, strategist.address, admin.address
        ])
        await yearnStrategy.deployed()

        // Migrate funds from vaults
        await network.provider.request({method: "hardhat_impersonateAccount", params: [ownerAddr],})
        const owner = await ethers.getSigner(ownerAddr)
        // Strategy
        const strategyABI = ["function vesting() external", "function approveMigrate() external"]
        const USDTStrategyContract = new ethers.Contract(USDTStrategyAddr, strategyABI, owner)
        const USDCStrategyContract = new ethers.Contract(USDCStrategyAddr, strategyABI, owner)
        const DAIStrategyContract = new ethers.Contract(DAIStrategyAddr, strategyABI, owner)
        const TUSDStrategyContract = new ethers.Contract(TUSDStrategyAddr, strategyABI, owner)
        await USDTStrategyContract.vesting()
        await USDCStrategyContract.vesting()
        await DAIStrategyContract.vesting()
        await TUSDStrategyContract.vesting()
        await USDTStrategyContract.approveMigrate()
        await USDCStrategyContract.approveMigrate()
        await DAIStrategyContract.approveMigrate()
        await TUSDStrategyContract.approveMigrate()
        // Vault
        USDTVaultContract = new ethers.Contract(USDTVaultAddr, vaultABI, owner)
        USDCVaultContract = new ethers.Contract(USDCVaultAddr, vaultABI, owner)
        DAIVaultContract = new ethers.Contract(DAIVaultAddr, vaultABI, owner)
        TUSDVaultContract = new ethers.Contract(TUSDVaultAddr, vaultABI, owner)
        await USDTVaultContract.setPendingStrategy(yearnStrategy.address)
        await USDCVaultContract.setPendingStrategy(yearnStrategy.address)
        await DAIVaultContract.setPendingStrategy(yearnStrategy.address)
        await TUSDVaultContract.setPendingStrategy(yearnStrategy.address)
        await USDTVaultContract.unlockMigrateFunds()
        await USDCVaultContract.unlockMigrateFunds()
        await DAIVaultContract.unlockMigrateFunds()
        await TUSDVaultContract.unlockMigrateFunds()
        network.provider.send("evm_increaseTime", [86400*2+1])
        await USDTVaultContract.migrateFunds()
        await USDCVaultContract.migrateFunds()
        await DAIVaultContract.migrateFunds()
        await TUSDVaultContract.migrateFunds()

        // Initial invest in YearnStrategy
        await yearnStrategy.initialInvest()

        // Transfer Stablecoins to client
        await network.provider.request({method: "hardhat_impersonateAccount", params: [unlockedAddr],})
        const unlockedAcc = await ethers.getSigner(unlockedAddr)
        const USDT = new ethers.Contract(USDTAddr, IERC20_ABI, unlockedAcc)
        const USDC = new ethers.Contract(USDCAddr, IERC20_ABI, unlockedAcc)
        const DAI = new ethers.Contract(DAIAddr, IERC20_ABI, unlockedAcc)
        const TUSD = new ethers.Contract(TUSDAddr, IERC20_ABI, unlockedAcc)
        await USDT.transfer(client.address, ethers.utils.parseUnits("10000", 6))
        await USDC.transfer(client.address, ethers.utils.parseUnits("10000", 6))
        await DAI.transfer(client.address, ethers.utils.parseUnits("10000", 18))
        await TUSD.transfer(client.address, ethers.utils.parseUnits("10000", 18))

        // Deposit into all vaults
        await USDT.connect(client).approve(yearnStrategy.address, ethers.constants.MaxUint256)
        await USDC.connect(client).approve(yearnStrategy.address, ethers.constants.MaxUint256)
        await DAI.connect(client).approve(yearnStrategy.address, ethers.constants.MaxUint256)
        await TUSD.connect(client).approve(yearnStrategy.address, ethers.constants.MaxUint256)
        await USDTVaultContract.connect(client).deposit([ethers.utils.parseUnits("10000", 6), 0])
        await USDCVaultContract.connect(client).deposit([ethers.utils.parseUnits("10000", 6), 0])
        await DAIVaultContract.connect(client).deposit([ethers.utils.parseUnits("10000", 18), 0])
        await TUSDVaultContract.connect(client).deposit([ethers.utils.parseUnits("10000", 18), 0])

        // console.log("----------")
        // console.log(ethers.utils.formatUnits(await USDTVaultContract.balanceOf(client.address), 6)) // 9644.936094
        // console.log(ethers.utils.formatUnits(await USDCVaultContract.balanceOf(client.address), 6))
        // console.log(ethers.utils.formatEther(await DAIVaultContract.balanceOf(client.address)))
        // console.log(ethers.utils.formatEther(await TUSDVaultContract.balanceOf(client.address)))
        // console.log("----------")

        // console.log("----------")
        // console.log(ethers.utils.formatUnits(await USDTVaultContract.totalSupply(), 6))
        // console.log(ethers.utils.formatUnits(await USDCVaultContract.totalSupply(), 6))
        // console.log(ethers.utils.formatEther(await DAIVaultContract.totalSupply()))
        // console.log(ethers.utils.formatEther(await TUSDVaultContract.totalSupply()))
        // console.log("----------")

        // console.log("----------")
        // console.log(ethers.utils.formatEther(await yearnStrategy.getAllPoolInUSD())) // 10658.365242614301612978
        // console.log(ethers.utils.formatUnits((await USDTVaultContract.balanceOf(client.address)).mul(await yearnStrategy.getAllPoolInUSD()).div(await yearnStrategy.totalSupply()), 6)) // 
        // console.log("----------")

        // Invest
        await yearnStrategy.invest()

        // console.log("----------")
        // console.log(ethers.utils.formatEther(await yearnStrategy.getAllPoolInUSD())) // 10606.689229839964267302
        // console.log(ethers.utils.formatUnits((await USDTVaultContract.balanceOf(client.address)).mul(await yearnStrategy.getAllPoolInUSD()).div(await yearnStrategy.totalSupply()), 6)) // 
        // console.log("----------")

        // Yield
        await yearnStrategy.yield()

        // console.log("----------")
        // console.log(ethers.utils.formatEther(await yearnStrategy.getAllPoolInUSD())) // 10618.497890062439409177
        // console.log(ethers.utils.formatUnits((await USDTVaultContract.balanceOf(client.address)).mul(await yearnStrategy.getAllPoolInUSD()).div(await yearnStrategy.totalSupply()), 6)) // 
        // console.log("----------")

        // console.log(ethers.utils.formatUnits(await USDTVaultContract.balanceOf(client.address), 6))

        // Withdraw from all vaults
        await USDTVaultContract.connect(client).withdraw([USDTVaultContract.balanceOf(client.address), 0])
        await USDCVaultContract.connect(client).withdraw([USDCVaultContract.balanceOf(client.address), 0])
        await DAIVaultContract.connect(client).withdraw([DAIVaultContract.balanceOf(client.address), 0])
        await TUSDVaultContract.connect(client).withdraw([TUSDVaultContract.balanceOf(client.address), 0])
        // console.log("----------")
        console.log("USDT withdraw:", ethers.utils.formatUnits(await USDT.balanceOf(client.address), 6)) // 9901.178928 9901.178928
        console.log("USDC withdraw:", ethers.utils.formatUnits(await USDC.balanceOf(client.address), 6)) // 9902.898936 9909.060684
        console.log("DAI withdraw:", ethers.utils.formatUnits(await DAI.balanceOf(client.address), 18)) // 9880.390486488723471396 9892.69317463211512348
        console.log("TUSD withdraw:", ethers.utils.formatUnits(await TUSD.balanceOf(client.address), 18)) // 9963.606049000577616791 9982.065173266135452104
        // console.log("----------")

        // console.log("----------")
        // console.log((await USDTVaultContract.balanceOf(client.address)).toString())
        // console.log((await USDCVaultContract.balanceOf(client.address)).toString())
        // console.log((await DAIVaultContract.balanceOf(client.address)).toString())
        // console.log((await TUSDVaultContract.balanceOf(client.address)).toString())
        // console.log("----------")

        // console.log("----------")
        // console.log(ethers.utils.formatUnits(await yearnStrategy.balanceOf(USDTVaultAddr), 6)) // 123.75
        // console.log(ethers.utils.formatUnits(await yearnStrategy.balanceOf(USDCVaultAddr), 6)) // 99.0
        // console.log(ethers.utils.formatUnits(await yearnStrategy.balanceOf(DAIVaultAddr), 18)) // 313.2390689999999604
        // console.log(ethers.utils.formatUnits(await yearnStrategy.balanceOf(TUSDVaultAddr), 18)) // 99.0
        // console.log(ethers.utils.formatEther(await yearnStrategy.totalSupply())) // 634.989069017847488596
        // console.log("----------")

        // // Withdraw with impersonate account
        // await network.provider.request({method: "hardhat_impersonateAccount", params: [oldUserAddr],})
        // const oldUser = await ethers.getSigner(oldUserAddr)
        // const before = await DAI.balanceOf(oldUserAddr)
        // await DAIVaultContract.connect(oldUser).withdraw([await DAIVaultContract.balanceOf(oldUserAddr), 0])
        // const after = await DAI.balanceOf(oldUserAddr)
        // console.log("DAI withdraw old user:", ethers.utils.formatEther(after.sub(before)))
    })
})