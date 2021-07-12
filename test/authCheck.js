const { ethers } = require("hardhat")
const { expect } = require("chai")

const lpTokenAddr = "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c"
const curvePoolAddr = "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c"
const curvePoolZap = "0xA79828DF1850E8a3A3064576f380D90aECDD3359"
const poolIndex = 36
const curveZapType = "CurveMetaPoolZap"

describe("DAO Earn", () => {
    it("should have correct authorization", async () => {
        const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
        const CurveZap = await ethers.getContractFactory(curveZapType, deployer)
        const curveZap = await CurveZap.deploy()
        const EarnStrategyTemplate = await ethers.getContractFactory("EarnStrategy", deployer)
        const earnStrategyTemplate = await EarnStrategyTemplate.deploy()
        const EarnStrategyFactory = await ethers.getContractFactory("EarnStrategyFactory", deployer)
        const earnStrategyFactory = await EarnStrategyFactory.deploy()
        await earnStrategyFactory.createStrategy(
            earnStrategyTemplate.address,
            poolIndex, curveZap.address,
            admin.address, community.address, strategist.address
        )
        const earnStrategyAddr = await earnStrategyFactory.strategies((await earnStrategyFactory.getTotalStrategies()).sub(1))
        const earnStrategy = await ethers.getContractAt("EarnStrategy", earnStrategyAddr, deployer)
        expect(await earnStrategy.owner()).to.equal(deployer.address)
        const EarnVaultTemplate = await ethers.getContractFactory("EarnVault", deployer)
        const earnVaultTemplate = await EarnVaultTemplate.deploy()
        const EarnVaultFactory = await ethers.getContractFactory("EarnVaultFactory", deployer)
        const earnVaultFactory = await EarnVaultFactory.deploy()
        await earnVaultFactory.createVault(
            earnVaultTemplate.address,
            earnStrategy.lpToken(), earnStrategyAddr, curveZap.address,
            treasury.address, community.address,
            admin.address, strategist.address, biconomy.address
        )
        const earnVaultAddr = await earnVaultFactory.vaults((await earnVaultFactory.getTotalVaults()).sub(1))
        await earnStrategy.setVault(earnVaultAddr)
        await curveZap.addPool(earnVaultAddr, curvePoolAddr, curvePoolZap)
        const earnVault = await ethers.getContractAt("EarnVault", earnVaultAddr, deployer)

        // EarnVaultFactory
        await expect(earnVaultFactory.connect(admin).createVault(
            earnVaultTemplate.address,
            earnStrategy.lpToken(), earnStrategyAddr, curveZap.address,
            treasury.address, community.address,
            admin.address, strategist.address, biconomy.address
        )).to.be.revertedWith("Ownable: caller is not the owner")

        // EarnStrategyFactory
        await expect(earnStrategyFactory.connect(admin).createStrategy(
            earnStrategyTemplate.address,
            poolIndex, curveZap.address,
            admin.address, community.address, strategist.address
        )).to.be.revertedWith("Ownable: caller is not the owner")
        
        // EarnVaut
        await expect(earnVault.init(
            earnStrategy.lpToken(), earnStrategyAddr, curveZap.address,
            treasury.address, community.address,
            admin.address, strategist.address, biconomy.address, deployer.address
        )).to.be.revertedWith("Initializable: contract is already initialized")
        await expect(earnVault.connect(client).depositZap(ethers.utils.parseEther("10000"), client.address)).to.be.revertedWith("Only CurveZap")
        await expect(earnVault.connect(client).withdrawZap(ethers.utils.parseEther("10000"), client.address)).to.be.revertedWith("Only CurveZap")
        await expect(earnVault.connect(client).transferOutFees()).to.be.revertedWith("Only authorized caller")
        await expect(earnVault.connect(client).invest()).to.be.revertedWith("Only owner or admin")
        await expect(earnVault.connect(client).yield()).to.be.revertedWith("Only owner or admin")
        await expect(earnVault.connect(client).retrievetokenFromStrategy(ethers.utils.parseEther("1000"))).to.be.revertedWith("Only owner or admin")
        await expect(earnVault.connect(client).emergencyWithdraw()).to.be.revertedWith("Only owner or admin")
        await expect(earnVault.connect(admin).setPendingStrategy(earnStrategy.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).unlockChangeStrategy()).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).changeStrategy()).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setNetworkFeeTier2([ethers.utils.parseEther("10000"), ethers.utils.parseEther("50000")])).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setCustomNetworkFeeTier(ethers.utils.parseEther("100000"))).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setNetworkFeePerc([200, 100, 75])).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setCustomNetworkFeePerc(50)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setProfitSharingFeePerc(2500)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setYieldFeePerc(2000)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(client).setPercTokenKeepInVault(1000)).to.be.revertedWith("Only owner or admin")
        await expect(earnVault.connect(admin).setCurveZap(curveZap.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setTreasuryWallet(admin.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setCommunityWallet(admin.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setBiconomy(admin.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setBiconomy(admin.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setAdmin(admin.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(earnVault.connect(admin).setStrategist(admin.address)).to.be.revertedWith("Only owner or strategist")

        // EarnStrategy
        await expect(earnStrategy.init(
            poolIndex, curveZap.address,
            admin.address, community.address, strategist.address, deployer.address
        )).to.be.revertedWith("Initializable: contract is already initialized")
        await expect(earnStrategy.invest(ethers.utils.parseEther("100"))).to.be.revertedWith("Only authorized caller")
        await expect(earnStrategy.yield()).to.be.revertedWith("Only vault")
        await expect(earnStrategy.withdraw(ethers.utils.parseEther("100"))).to.be.revertedWith("Only vault")
        await expect(earnStrategy.emergencyWithdraw()).to.be.revertedWith("Only vault")
        await expect(earnStrategy.setVault(earnVaultAddr)).to.be.revertedWith("Vault set")
        await expect(earnStrategy.setCurveZap(curveZap.address)).to.be.revertedWith("Only vault")
        await expect(earnStrategy.setYieldFeePerc(1000)).to.be.revertedWith("Only vault")
        await expect(earnStrategy.setCommunityWallet(deployer.address)).to.be.revertedWith("Only vault")
        await expect(earnStrategy.setAdmin(deployer.address)).to.be.revertedWith("Only vault")
        await expect(earnStrategy.setStrategist(deployer.address)).to.be.revertedWith("Only vault")

        // CurveMetaPoolZap
        const Sample = await ethers.getContractFactory("Sample", deployer)
        const sample = await Sample.deploy(lpTokenAddr, earnVaultAddr, curveZap.address)
        await expect(sample.depositZap1()).to.be.revertedWith("Only EOA or Biconomy")
        await expect(sample.depositZap2()).to.be.revertedWith("Only EOA or Biconomy")
        await expect(sample.withdrawZap()).to.be.revertedWith("Only EOA")
        await expect(curveZap.swapFees(ethers.utils.parseEther("100"))).to.be.revertedWith("Only authorized vault")
        await expect(curveZap.compound(ethers.utils.parseEther("100"), earnVaultAddr)).to.be.revertedWith("Only authorized strategy")
        await expect(curveZap.emergencyWithdraw(ethers.utils.parseEther("100"), earnVaultAddr)).to.be.revertedWith("Only authorized strategy")
        await expect(curveZap.connect(admin).addPool(earnVaultAddr, curvePoolAddr, curvePoolZap)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(curveZap.setStrategy(earnStrategyAddr)).to.be.revertedWith("Only authorized vault")
        await expect(curveZap.connect(client).setBiconomy(client.address)).to.be.revertedWith("Ownable: caller is not the owner")
    })
})