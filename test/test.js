const { ethers, network } = require("hardhat")
const { expect } = require("chai")
const IERC20_ABI = require("../abis/IERC20_ABI.json")

const USDTAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const unlockedAddress = "0x28C6c06298d514Db089934071355E5743bf21d60"

describe("DAO Stablecoins Strategy", () => {
    it("should work", async () => {
        let tx, receipt
        const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
        const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
        const earnStrategy = await EarnStrategy.deploy()
        // receipt = await earnStrategy.deployTransaction.wait()
        // console.log(receipt.gasUsed.toString())
        const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
        const zapReward = await ZapReward.deploy(earnStrategy.address)
        // receipt = await zapReward.deployTransaction.wait()
        // console.log(receipt.gasUsed.toString())
        await earnStrategy.setZapReward(zapReward.address)
        const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
        const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
        // receipt = await earnVault.deployTransaction.wait()
        // console.log(receipt.gasUsed.toString())
        await earnStrategy.setVault(earnVault.address)

        await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
        const unlockedSigner = await ethers.getSigner(unlockedAddress);
        const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
        const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
        const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
        await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
        await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
        await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
        await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

        // Add pool and set pool
        await earnVault.connect(admin).addPool(4) // susdv2
        await earnVault.connect(admin).switchPool(4)

        // Deposit
        tx = await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        tx = await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())
        tx = await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Invest
        tx = await earnVault.connect(admin).invest()
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString())

        // Second deposit and invest
        await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
        await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
        await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), 2)
        await earnVault.connect(admin).invest()

        // Fees
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(treasury.address), 6))
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(community.address), 6))
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(strategist.address), 6))

        // Balance keep in vault
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(earnVault.address)))
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(earnVault.address), 6))
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(earnVault.address), 6))

        // Swap token within vault
        // await earnVault.connect(admin).swapTokenWithinVault(2, 1, ethers.utils.parseUnits("500", 18))
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(earnVault.address), 6))
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(earnVault.address), 6))
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(earnVault.address)))

        // Yield
        await earnVault.connect(admin).yield()
        // expect(await community.getBalance()).to.gt(ethers.utils.parseEther("1"))
        // expect(await strategist.getBalance()).to.gt(ethers.utils.parseEther("1"))

        // Reimburse from strategy
        // await earnVault.connect(admin).retrieveStablecoinsFromStrategy(0, ethers.utils.parseUnits("1000", 6))
        // await earnVault.connect(admin).retrieveStablecoinsFromStrategy(1, ethers.utils.parseUnits("1000", 6))
        // await earnVault.connect(admin).retrieveStablecoinsFromStrategy(2, ethers.utils.parseUnits("1000", 6))
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(earnVault.address), 6))
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(earnVault.address), 6))
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(earnVault.address)))

        // Switch pool
        await earnVault.connect(admin).addPool(34)
        await earnVault.connect(admin).switchPool(34)
        // await earnVault.connect(admin).addPool(2)
        // await earnVault.connect(admin).switchPool(2)
        // await earnVault.connect(admin).addPool(26)
        // await earnVault.connect(admin).switchPool(26)
        // await earnVault.connect(admin).addPool(13)
        // await earnVault.connect(admin).switchPool(13)
        // await earnVault.connect(admin).addPool(36)
        // await earnVault.connect(admin).switchPool(36)
        // await earnVault.connect(admin).addPool(21)
        // await earnVault.connect(admin).switchPool(21)
        // await earnVault.connect(admin).addPool(24)
        // await earnVault.connect(admin).switchPool(24)
        // await earnVault.connect(admin).addPool(33)
        // await earnVault.connect(admin).switchPool(33)
        // await earnVault.connect(admin).addPool(0)
        // await earnVault.connect(admin).switchPool(0)

        // Emergency withdraw
        // const cvStake = new ethers.Contract("0x22eE18aca7F3Ee920D01F25dA85840D12d98E8Ca", ["function balanceOf(address) external view returns (uint)"], deployer)
        // console.log((await cvStake.balanceOf(earnStrategy.address)).toString())
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(earnVault.address), 6))
        await earnVault.connect(admin).emergencyWithdraw()
        // console.log((await cvStake.balanceOf(earnStrategy.address)).toString())
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(earnVault.address), 6))
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(earnVault.address), 6))
        // console.log(ethers.utils.formatEther(await DAIContract.balanceOf(earnVault.address)))
        await earnVault.connect(admin).reinvest()
        // console.log((await cvStake.balanceOf(earnStrategy.address)).toString())
        // console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(earnVault.address), 6))

        const withdrawAmt = await earnVault.balanceOf(client.address)
        await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
        // console.log("DAI withdraw:", ethers.utils.formatEther(await DAIContract.balanceOf(client.address)))
        await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
        // console.log("USDC withdraw:", ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6))
        await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
        // console.log("USDT withdraw:", ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6))

        // Migrate funds
        // const EarnStrategy2 = await ethers.getContractFactory("EarnStrategy", deployer)
        // const earnStrategy2 = await EarnStrategy2.deploy()
        // await earnStrategy2.setVault(earnVault.address)
        // await earnVault.setPendingStrategy(earnStrategy2.address)
        // await earnVault.connect(admin).emergencyWithdraw()
        // await earnVault.unlockInvestNewStrategy()
        // network.provider.send("evm_increaseTime", [86400*2])
        // await earnVault.investNewStrategy()
        // await earnVault.connect(admin).addPool(4) // susdv2
        // await earnVault.connect(admin).switchPool(4)
        // await earnVault.connect(admin).reinvest()
        // await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
        // await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
        // await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), 2)
        // await earnVault.connect(admin).invest()
        // expect(await earnVault.strategy()).to.equal(earnStrategy2.address)

        // // Admin functions
        // await earnVault.connect(admin).setPercTokenKeepInVault([300, 300, 300])
        // expect((await earnVault.tokens(0))[2]).to.equal(300)
        // expect((await earnVault.tokens(1))[2]).to.equal(300)
        // expect((await earnVault.tokens(2))[2]).to.equal(300)
        // await earnVault.setNetworkFeeTier2([1000000000, 5000000000])
        // expect(await earnVault.networkFeeTier2(0)).to.equal(1000000000)
        // expect(await earnVault.networkFeeTier2(1)).to.equal(5000000000)
        // await earnVault.setCustomNetworkFeeTier(100000000000)
        // expect(await earnVault.customNetworkFeeTier()).to.equal(100000000000)
        // await earnVault.setNetworkFeePerc([200, 100, 75])
        // expect(await earnVault.networkFeePerc(0)).to.equal(200)
        // expect(await earnVault.networkFeePerc(1)).to.equal(100)
        // expect(await earnVault.networkFeePerc(2)).to.equal(75)
        // await earnVault.setCustomNetworkFeePerc(50)
        // expect(await earnVault.customNetworkFeePerc()).to.equal(50)
        // await earnVault.setProfitSharingFeePerc(2500);
        // expect(await earnVault.profitSharingFeePerc()).to.equal(2500)
        // const sampleAddress = "0xb1AD074E17AD59f2103A8832DADE917388D6C50D"
        // await earnVault.setTreasuryWallet(sampleAddress)
        // expect(await earnVault.treasuryWallet()).to.equal(sampleAddress)
        // await earnVault.setCommunityWallet(sampleAddress)
        // expect(await earnVault.communityWallet()).to.equal(sampleAddress)
        // expect(await earnStrategy.communityWallet()).to.equal(sampleAddress)
        // await earnVault.setBiconomy(sampleAddress)
        // expect(await earnVault.trustedForwarder()).to.equal(sampleAddress)
        // await earnVault.setAdmin(sampleAddress)
        // expect(await earnVault.admin()).to.equal(sampleAddress)
        // expect(await earnStrategy.admin()).to.equal(sampleAddress)
        // await earnVault.connect(strategist).setStrategist(sampleAddress)
        // expect(await earnVault.strategist()).to.equal(sampleAddress)
        // expect(await earnStrategy.strategist()).to.equal(sampleAddress)
    })

    // it("should work for busdv2", async () => {
    //     const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    //     const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
    //     const earnStrategy = await EarnStrategy.deploy()
    //     const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
    //     const zapReward = await ZapReward.deploy(earnStrategy.address)
    //     await earnStrategy.setZapReward(zapReward.address)
    //     const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    //     const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
    //     await earnStrategy.setVault(earnVault.address)

    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
    //     const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
    //     const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
    //     await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
    //     await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

    //     await earnVault.connect(admin).addPool(34) // busdv2
    //     await earnVault.connect(admin).switchPool(34)

    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
    //     await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)

    //     await earnVault.connect(admin).invest()
    //     await earnVault.connect(admin).yield()

    //     const withdrawAmt = await earnVault.balanceOf(client.address)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
    // })

    // it("should work for Y", async () => {
    //     const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    //     const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
    //     const earnStrategy = await EarnStrategy.deploy()
    //     const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
    //     const zapReward = await ZapReward.deploy(earnStrategy.address)
    //     await earnStrategy.setZapReward(zapReward.address)
    //     const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    //     const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
    //     await earnStrategy.setVault(earnVault.address)

    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
    //     const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
    //     const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
    //     await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
    //     await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

    //     await earnVault.connect(admin).addPool(2) // Y
    //     await earnVault.connect(admin).switchPool(2)

    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
    //     await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)

    //     await earnVault.connect(admin).invest()
    //     await earnVault.connect(admin).yield()

    //     const withdrawAmt = await earnVault.balanceOf(client.address)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
    // })

    // it("should work for saave", async () => {
    //     const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    //     const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
    //     const earnStrategy = await EarnStrategy.deploy()
    //     const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
    //     const zapReward = await ZapReward.deploy(earnStrategy.address)
    //     await earnStrategy.setZapReward(zapReward.address)
    //     const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    //     const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
    //     await earnStrategy.setVault(earnVault.address)

    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
    //     const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
    //     const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
    //     await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
    //     await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

    //     await earnVault.connect(admin).addPool(26) // saave
    //     await earnVault.connect(admin).switchPool(26)

    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
    //     await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)

    //     await earnVault.connect(admin).invest()
    //     await earnVault.connect(admin).yield()

    //     const withdrawAmt = await earnVault.balanceOf(client.address)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
    // })

    // it("should work for usdn", async () => {
    //     const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    //     const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
    //     const earnStrategy = await EarnStrategy.deploy()
    //     const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
    //     const zapReward = await ZapReward.deploy(earnStrategy.address)
    //     await earnStrategy.setZapReward(zapReward.address)
    //     const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    //     const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
    //     await earnStrategy.setVault(earnVault.address)

    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
    //     const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
    //     const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
    //     await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
    //     await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

    //     await earnVault.connect(admin).addPool(13) // usdn
    //     await earnVault.connect(admin).switchPool(13)

    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
    //     await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)

    //     await earnVault.connect(admin).invest()
    //     await earnVault.connect(admin).yield()

    //     const withdrawAmt = await earnVault.balanceOf(client.address)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
    // })

    // it("should work for alusd", async () => {
    //     const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    //     const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
    //     const earnStrategy = await EarnStrategy.deploy()
    //     const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
    //     const zapReward = await ZapReward.deploy(earnStrategy.address)
    //     await earnStrategy.setZapReward(zapReward.address)
    //     const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    //     const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
    //     await earnStrategy.setVault(earnVault.address)

    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
    //     const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
    //     const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
    //     await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
    //     await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

    //     await earnVault.connect(admin).addPool(36) // alusd
    //     await earnVault.connect(admin).switchPool(36)

    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
    //     await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)

    //     await earnVault.connect(admin).invest()
    //     await earnVault.connect(admin).yield()

    //     const withdrawAmt = await earnVault.balanceOf(client.address)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
    // })

    // it("should work for ust", async () => {
    //     const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    //     const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
    //     const earnStrategy = await EarnStrategy.deploy()
    //     const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
    //     const zapReward = await ZapReward.deploy(earnStrategy.address)
    //     await earnStrategy.setZapReward(zapReward.address)
    //     const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    //     const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
    //     await earnStrategy.setVault(earnVault.address)

    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
    //     const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
    //     const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
    //     await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
    //     await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

    //     await earnVault.connect(admin).addPool(21) // ust
    //     await earnVault.connect(admin).switchPool(21)

    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
    //     await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)

    //     await earnVault.connect(admin).invest()
    //     await earnVault.connect(admin).yield()

    //     const withdrawAmt = await earnVault.balanceOf(client.address)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
    // })

    // it("should work for aave", async () => {
    //     const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    //     const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
    //     const earnStrategy = await EarnStrategy.deploy()
    //     const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
    //     const zapReward = await ZapReward.deploy(earnStrategy.address)
    //     await earnStrategy.setZapReward(zapReward.address)
    //     const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    //     const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
    //     await earnStrategy.setVault(earnVault.address)

    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
    //     const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
    //     const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
    //     await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
    //     await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

    //     await earnVault.connect(admin).addPool(24) // aave
    //     await earnVault.connect(admin).switchPool(24)

    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
    //     await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)

    //     await earnVault.connect(admin).invest()
    //     await earnVault.connect(admin).yield()

    //     const withdrawAmt = await earnVault.balanceOf(client.address)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
    // })

    // it("should work for lusd", async () => {
    //     const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    //     const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
    //     const earnStrategy = await EarnStrategy.deploy()
    //     const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
    //     const zapReward = await ZapReward.deploy(earnStrategy.address)
    //     await earnStrategy.setZapReward(zapReward.address)
    //     const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    //     const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
    //     await earnStrategy.setVault(earnVault.address)

    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
    //     const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
    //     const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
    //     await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
    //     await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

    //     await earnVault.connect(admin).addPool(33) // lusd
    //     await earnVault.connect(admin).switchPool(33)

    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
    //     await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)

    //     await earnVault.connect(admin).invest()
    //     await earnVault.connect(admin).yield()

    //     const withdrawAmt = await earnVault.balanceOf(client.address)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
    // })

    // it("should work for comp", async () => {
    //     const [deployer, client, admin, strategist, biconomy, treasury, community] = await ethers.getSigners()
    //     const EarnStrategy = await ethers.getContractFactory("EarnStrategy", deployer)
    //     const earnStrategy = await EarnStrategy.deploy()
    //     const ZapReward = await ethers.getContractFactory("ZapReward", deployer)
    //     const zapReward = await ZapReward.deploy(earnStrategy.address)
    //     await earnStrategy.setZapReward(zapReward.address)
    //     const EarnVault = await ethers.getContractFactory("EarnVault", deployer)
    //     const earnVault = await EarnVault.deploy(earnStrategy.address, treasury.address, community.address, admin.address, strategist.address, biconomy.address)
    //     await earnStrategy.setVault(earnVault.address)

    //     await network.provider.request({method: "hardhat_impersonateAccount",params: [unlockedAddress],});
    //     const unlockedSigner = await ethers.getSigner(unlockedAddress);
    //     const USDTContract = new ethers.Contract(USDTAddress, IERC20_ABI, unlockedSigner);
    //     const USDCContract = new ethers.Contract(USDCAddress, IERC20_ABI, unlockedSigner);
    //     const DAIContract = new ethers.Contract(DAIAddress, IERC20_ABI, unlockedSigner);
    //     await USDTContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await USDCContract.transfer(client.address, ethers.utils.parseUnits("20000", 6))
    //     await DAIContract.transfer(client.address, ethers.utils.parseEther("20000"))
    //     await USDTContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await USDCContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)
    //     await DAIContract.connect(client).approve(earnVault.address, ethers.constants.MaxUint256)

    //     await earnVault.connect(admin).addPool(0) // comp
    //     await earnVault.connect(admin).switchPool(0)

    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 0)
    //     await earnVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), 1)
    //     await earnVault.connect(client).deposit(ethers.utils.parseEther("10000"), 2)

    //     await earnVault.connect(admin).invest()
    //     await earnVault.connect(admin).yield()

    //     const withdrawAmt = await earnVault.balanceOf(client.address)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 2)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 1)
    //     await earnVault.connect(client).withdraw((withdrawAmt).mul(3).div(10), 0)
    // })
})