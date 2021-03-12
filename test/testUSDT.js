const { expect } = require("chai")
const { ethers, network, deployments, waffle, artifacts } = require("hardhat")
const { mainnet: network_ } = require("../addresses")
require("dotenv").config()
const IERC20_ABI = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json").abi
const IYearn_ABI = require("../artifacts/interfaces/IYearn.sol/IYearn.json").abi
const IYvault_ABI = require("../artifacts/interfaces/IYvault.sol/IYvault.json").abi

// USDT
const { tokenAddress, yEarnAddress, yVaultAddress } = network_.USDT
const treasuryWalletAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
const communityWalletAddress = "0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0"

describe("YearnFarmerUSDTv2", () => {
    const setup = async () => {
        const [deployerSigner, clientSigner] = await ethers.getSigners()

        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        const yEarnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, deployerSigner)
        const yVaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, deployerSigner)

        const yfUSDTContract = await ethers.getContract("YearnFarmerUSDTv2")
        const dvmUSDTContract = await ethers.getContract("DAOVaultMediumUSDT")

        return { deployerSigner, clientSigner , tokenContract, yEarnContract, yVaultContract, yfUSDTContract, dvmUSDTContract }
    }

    beforeEach(async () => {
        await deployments.fixture()
    })

    it("should deploy contract correctly", async () => {
        // Get sender address and deploy the contracts
        const { deployerSigner, yfUSDTContract, dvmUSDTContract } = await setup()
        // Check if execute set vault function again to be reverted
        await expect(yfUSDTContract.setVault(deployerSigner.address)).to.be.revertedWith("Vault set")
        // Check if contract owner is contract deployer in both contracts
        expect(await yfUSDTContract.owner()).to.equal(deployerSigner.address)
        expect(await dvmUSDTContract.owner()).to.equal(deployerSigner.address)
        // Check if token accept is USDT in both contract
        expect(await yfUSDTContract.token()).to.equal(tokenAddress)
        expect(await dvmUSDTContract.token()).to.equal(tokenAddress)
        // Check if Yearn USDT Earn contract and Yearn USDT Vault contract match given contract in Yearn Farmer contract
        expect(await yfUSDTContract.earn()).to.equal(yEarnAddress)
        expect(await yfUSDTContract.vault()).to.equal(yVaultAddress)
        // Check if initial pool set correctly in Yearn Farmer contract
        expect(await yfUSDTContract.pool()).to.equal(0)
        // Check if treasury wallet address match given address in Yearn Farmer contract
        expect(await yfUSDTContract.treasuryWallet()).to.equal(treasuryWalletAddress)
        // Check if community wallet address match given address in Yearn Farmer contract
        expect(await yfUSDTContract.communityWallet()).to.equal(communityWalletAddress)
        // Check if initial tier2 of network fee is 50001e6 <= tokenAmount <= 100000e6 in Yearn Farmer contract (More details in contract)
        expect(await yfUSDTContract.networkFeeTier2(0)).to.equal("50000000001")
        expect(await yfUSDTContract.networkFeeTier2(1)).to.equal("100000000000")
        // Check if initial network fee percentage is 1% for tier1, 0.75% for tier2, and 0.5% for tier3 in Yearn Farmer contract (More details in contract)
        expect(await yfUSDTContract.networkFeePercentage(0)).to.equal(100) // 1% = 100/10000, more detail in contract
        expect(await yfUSDTContract.networkFeePercentage(1)).to.equal(75) // 1% = 50/10000, more detail in contract
        expect(await yfUSDTContract.networkFeePercentage(2)).to.equal(50) // 1% = 25/10000, more detail in contract
        // Check if initial custom network fee tier is 1000000e6
        expect(await yfUSDTContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("1", 12))
        // Check if initial custom network fee percentage is 0.25%
        expect(await yfUSDTContract.customNetworkFeePercentage()).to.equal(25)
        // Check if initial profile sharing fee percentage is 10% in Yearn Farmer contract
        expect(await yfUSDTContract.profileSharingFeePercentage()).to.equal(1000)
        // Check if contract is not vesting in Yearn Farmer contract
        expect(await yfUSDTContract.isVesting()).is.false
        // Check if daoVaultUSDT contract address set correctly in Yearn Farmer contract
        expect(await yfUSDTContract.daoVault()).to.equal(dvmUSDTContract.address)
        // Check daoUSDT token is set properly in daoVaultUSDT contract
        expect(await dvmUSDTContract.name()).to.equal("DAO Vault Medium USDT")
        expect(await dvmUSDTContract.symbol()).to.equal("dvmUSDT")
        expect(await dvmUSDTContract.decimals()).to.equal(6)
        // Check if strategy match given contract in daoVaultUSDT contract
        expect(await dvmUSDTContract.strategy()).to.equal(yfUSDTContract.address)
        // Check pendingStrategy is no pre-set in daoVaultUSDT contract
        expect(await dvmUSDTContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
        expect(await dvmUSDTContract.canSetPendingStrategy()).is.true
        // Check if no unlockTime set yet in daoVaultUSDT contract
        expect(await dvmUSDTContract.unlockTime()).to.equal(0)
        // Check if timelock duration is 2 days in daoVaultUSDT contract
        expect(await dvmUSDTContract.LOCKTIME()).to.equal(2*24*60*60) // 2 days in seconds
    })

    // Check user functions
    describe("User functions", () => {
        it("should able to deposit earn and vault correctly", async () => {
            // Get sender address and deploy the contracts
            const { deployerSigner, clientSigner, tokenContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Transfer some USDT to client
            await tokenContract.transfer(clientSigner.address, "1000000000")
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal("1000000000")
            // Check if meet the function requirements
            const sampleContract_JSON = require("../build/SampleContract.json")
            const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvmUSDTContract.address, tokenContract.address])
            await tokenContract.transfer(sampleContract.address, "1000000000")
            expect(await tokenContract.balanceOf(sampleContract.address)).to.equal("1000000000")
            await sampleContract.approve(yfUSDTContract.address)
            await expect(sampleContract.deposit()).to.be.revertedWith("Only EOA")
            await expect(dvmUSDTContract.connect(clientSigner).deposit([0, 0])).to.be.revertedWith("Amount must > 0")
            await expect(yfUSDTContract.connect(clientSigner).deposit(["100000000", "200000000"])).to.be.revertedWith("Only can call from Vault")
            // Deposit 100 USDT to Yearn Earn contract and 200 to Yearn Vault Contract
            await tokenContract.connect(clientSigner).approve(yfUSDTContract.address, "10000000000")
            const tx = await dvmUSDTContract.connect(clientSigner).deposit(["100000000", "200000000"])
            // Check if user deposit successfully with correct amount
            const earnDepositAmount = await yfUSDTContract.getEarnDepositBalance(clientSigner.address)
            const vaultDepositAmount = await yfUSDTContract.getVaultDepositBalance(clientSigner.address)
            // Network fee for amount < 10000 is 1% by default
            const earnDepositBalance = "100000000" - Math.floor(100000000 * 1 / 100)
            const vaultDepositBalance = "200000000" - Math.floor(200000000 * 1 / 100)
            expect(earnDepositAmount).to.equal(earnDepositBalance)
            expect(vaultDepositAmount).to.equal(vaultDepositBalance)
            expect(await dvmUSDTContract.balanceOf(clientSigner.address)).to.equal(earnDepositAmount.add(vaultDepositAmount))
        })

        it("should deduct correct fees from deposit amount based on tier", async () => {
            // Get signer and address of sender and deploy the contracts
            const { deployerSigner, tokenContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Check deduct network fee correctly in tier 1
            await tokenContract.approve(yfUSDTContract.address, ethers.utils.parseEther("1"))
            let earnDepositBalance, vaultDepositBalance
            await dvmUSDTContract.deposit(["100000000", "200000000"])
            // Network fee for amount < 10000 is 1% in tier 1 by default
            earnDepositBalance = "100000000" - Math.floor(100000000 * 1 / 100)
            vaultDepositBalance = "200000000" - Math.floor(200000000 * 1 / 100)
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(Math.floor(earnDepositBalance))
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(Math.floor(vaultDepositBalance))
            // Check deduct network fee correctly in tier 2
            await dvmUSDTContract.deposit(["60000000000", "20000000000"])
            // Network fee for amount > 50000 and amount <= 100000 is 0.75% in tier 2 by default
            earnDepositBalance = earnDepositBalance + Math.floor("60000000000" - Math.floor(60000000000 * 0.75 / 100))
            vaultDepositBalance = vaultDepositBalance + Math.floor("20000000000" - Math.floor(20000000000 * 0.75 / 100))
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(earnDepositBalance)
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(vaultDepositBalance)
            // Check deduct network fee correctly in tier 3
            await dvmUSDTContract.deposit(["100000000000", "200000000000"])
            // Network fee for amount > 100000 is 0.5% in tier 3 by default
            earnDepositBalance = earnDepositBalance + Math.floor(100000000000 - Math.floor(100000000000 * 0.5 / 100))
            vaultDepositBalance = vaultDepositBalance + Math.floor(200000000000 - Math.floor(200000000000 * 0.5 / 100))
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(earnDepositBalance)
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(vaultDepositBalance)
            // Check deduct network fee correctly in custom tier
            await dvmUSDTContract.deposit(["1000000000000", "2000000000000"])
            // Network fee for amount > 1000000 is 0.25% in custom tier by default
            earnDepositBalance = earnDepositBalance + Math.floor(1000000000000 - Math.floor(1000000000000 * 0.25 / 100))
            vaultDepositBalance = vaultDepositBalance + Math.floor(2000000000000 - Math.floor(2000000000000 * 0.25 / 100))
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(earnDepositBalance)
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(vaultDepositBalance)
        })

        it("should withdraw earn and vault correctly", async () => {
            // Get signer and address of sender and deploy the contracts
            const { clientSigner, tokenContract, yEarnContract, yVaultContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Transfer some USDT to client
            await tokenContract.transfer(clientSigner.address, "1000000000")
            // Deposit some USDT into Yearn Farmer contract
            await tokenContract.connect(clientSigner).approve(yfUSDTContract.address, "1000000000")
            const clientTokenAmountBeforeDeposit = await tokenContract.balanceOf(clientSigner.address)
            const earnDepositAmount = new ethers.BigNumber.from("100000000")
            const vaultDepositAmount = new ethers.BigNumber.from("200000000")
            await dvmUSDTContract.connect(clientSigner).deposit([earnDepositAmount, vaultDepositAmount])
            // Check if withdraw amount meet the function requirements
            await expect(dvmUSDTContract.connect(clientSigner).withdraw(["1000000000", 0])).to.be.revertedWith("Insufficient balance")
            await expect(dvmUSDTContract.connect(clientSigner).withdraw([0, "1000000000"])).to.be.revertedWith("Insufficient balance")
            await expect(yfUSDTContract.connect(clientSigner).withdraw(["100000000", "200000000"])).to.be.revertedWith("Only can call from Vault")
            // Get Yearn Farmer earn and vault deposit amount of client account 
            const earnDepositBalance = await yfUSDTContract.getEarnDepositBalance(clientSigner.address)
            const vaultDepositBalance = await yfUSDTContract.getVaultDepositBalance(clientSigner.address)
            // Get off-chain actual withdraw USDT amount based on Yearn Earn and Vault contract
            const earnSharesInYearnContract = (earnDepositBalance.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            const actualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(earnSharesInYearnContract)).div(await yEarnContract.totalSupply())
            const vaultSharesinYearnContract = (vaultDepositBalance.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            const actualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(vaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            // Get shares based on deposit
            const daoEarnShares = earnDepositBalance.mul(await dvmUSDTContract.totalSupply()).div(await yfUSDTContract.pool())
            const daoVaultUSDTShares = vaultDepositBalance.mul(await dvmUSDTContract.totalSupply()).div(await yfUSDTContract.pool())
            // Withdraw all from Yearn Earn and Vault
            await dvmUSDTContract.connect(clientSigner).withdraw([daoEarnShares, daoVaultUSDTShares])
            // Check if balance deposit amount in Yearn Farmer contract is correct
            expect(await yfUSDTContract.getEarnDepositBalance(clientSigner.address)).to.equal(0)
            expect(await yfUSDTContract.getVaultDepositBalance(clientSigner.address)).to.equal(0)
            // Check if daoUSDT in client account is correct
            expect(await dvmUSDTContract.balanceOf(clientSigner.address)).to.equal(0)
            // Check if pool amount in contract is Yearn Farmer is correct
            expect(await yfUSDTContract.pool()).to.equal(0)
            // Check if USDT amount withdraw from Yearn Farmer contract is correct
            const clientTokenAmountAfterWithdraw = clientTokenAmountBeforeDeposit.sub(earnDepositAmount.add(vaultDepositAmount)).add(actualEarnWithdrawAmount.add(actualVaultWithdrawAmount))
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(clientTokenAmountAfterWithdraw) // Sometimes this will failed because of very small variation
        })

        // it("should withdraw earn and vault correctly if there is profit", async () => {
        //     // To run this test you must comment out r variable in withdrawEarn() and withdrawVault() function
        //     // and assign r with the amount higher than deposit amount
        //     // For example "uint256 r = 200000000" in withdrawEarn() and "uint256 r = 400000000" in withdrawVault
        //     // if deposit 100000000 for Yearn Earn contract and 200000000 for Yearn Vault contract
        //     // Besides, you must provide some USDT to Yearn Farmer contract as profit from Yearn contract
        //     // Get signer and address of sender and deploy the contracts
        //     const { deployerSigner, tokenContract, yfUSDTContract, dvmUSDTContract } = await setup()
        //     // Get treasury wallet USDT balance before deposit
        //     const treasuryWalletTokenBalBeforeDeposit = await tokenContract.balanceOf(treasuryWalletAddress)
        //     // Get community wallet USDT balance before deposit
        //     const communityWalletTokenBalBeforeDeposit = await tokenContract.balanceOf(communityWalletAddress)
        //     // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
        //     await tokenContract.approve(yfUSDTContract.address, "1000000000")
        //     await dvmUSDTContract.deposit(["100000000", "200000000"])
        //     // Transfer some USDT to Yearn Farmer contract as profit from Yearn contract
        //     await tokenContract.transfer(yfUSDTContract.address, "1000000000")
        //     // Record USDT amount of sender before withdraw earn shares
        //     const senderTokenAmountBeforeWithdraw = await tokenContract.balanceOf(deployerSigner.address)
        //     // Get earn and vault deposit balance of sender 
        //     const earnDepositBalance = await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)
        //     const vaultDepositBalance = await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)
        //     // Calculate fees for earn and vault profit
        //     const earnExampleWithdrawAmount = new ethers.BigNumber.from("200000000")
        //     const earnFee = (earnExampleWithdrawAmount.sub(earnDepositBalance)).mul(10).div(100) // .mul(10).div(100): 10% profile sharing fee 
        //     const vaultExampleWithdrawAmount = new ethers.BigNumber.from("400000000")
        //     const vaultFee = (vaultExampleWithdrawAmount.sub(vaultDepositBalance)).mul(10).div(100) // .mul(10).div(100): 10% profile sharing fee 
        //     // Get shares based on deposit
        //     const daoEarnShares = earnDepositBalance.mul(await dvmUSDTContract.totalSupply()).div(await yfUSDTContract.pool())
        //     const daoVaultUSDTShares = vaultDepositBalance.mul(await dvmUSDTContract.totalSupply()).div(await yfUSDTContract.pool())
        //     // Withdraw all from Yearn Earn and Vault contract
        //     await dvmUSDTContract.withdraw([daoEarnShares, daoVaultUSDTShares])
        //     // Check if total token balance is correct after withdraw
        //     expect(await tokenContract.balanceOf(deployerSigner.address)).to.equal(
        //         senderTokenAmountBeforeWithdraw
        //         .add(earnExampleWithdrawAmount.sub(earnFee))
        //         .add(vaultExampleWithdrawAmount.sub(vaultFee))
        //     )
        //     // Check if all fees transfer to treasury and community wallet correctly
        //     const networkFees = Math.floor((100000000 + 200000000) * 1 / 100) // 1% network fee for tier 1, for treasury wallet only
        //     const profileSharingFees = (earnFee.add(vaultFee)).mul(50).div(100) // 50% split between treasury and community wallet
        //     expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryWalletTokenBalBeforeDeposit.add(profileSharingFees.add(networkFees)))
        //     expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityWalletTokenBalBeforeDeposit.add(profileSharingFees))
        // })

        it("should able to get earn and vault deposit amount correctly", async () => {
            // Get signer and address of sender and client and deploy the contracts
            const { deployerSigner, clientSigner, tokenContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await tokenContract.approve(yfUSDTContract.address, "1000000000")
            await dvmUSDTContract.deposit(["100000000", "200000000"])
            // Deposit another 300 to Yearn Earn contract and 400 to Yearn Vault contract
            await dvmUSDTContract.deposit(["300000000", "400000000"])
            // Check if balance deposit of Yearn Earn contract and Yearn Vault contract after network fee return correctly
            const totalEarnDepositAfterFee = (100000000 + 300000000) - Math.floor((100000000 + 300000000) * 0.01) // 0.01: 1% network fee for tier 1
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(totalEarnDepositAfterFee)
            const totalVaultDepositAfterFee = (200000000 + 400000000) - Math.floor((200000000 + 400000000) * 0.01) // 0.01: 1% network fee for tier 1
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(totalVaultDepositAfterFee)
            // Transfer some USDT to client account
            await tokenContract.transfer(clientSigner.address, "1000000000")
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal("1000000000")
            // Deposit 150 to Yearn Earn contract and 250 to Yearn Vault contract from client
            await tokenContract.connect(clientSigner).approve(yfUSDTContract.address, "1000000000")
            await dvmUSDTContract.connect(clientSigner).deposit(["150000000", "250000000"])
            // Check if balance deposit of Yearn Earn contract and Yearn Vault contract after network fee from another account return correctly
            expect(await yfUSDTContract.getEarnDepositBalance(clientSigner.address)).to.equal(150000000 - Math.floor(150000000 * 0.01)) // 0.01: 1% network fee for tier 1
            expect(await yfUSDTContract.getVaultDepositBalance(clientSigner.address)).to.equal(250000000 - Math.floor(250000000 * 0.01)) // 0.01: 1% network fee for tier 1
        })

        it("should able to deal with mix and match situation (deposit and withdraw several times by several parties)", async () => {
             // Get signer and address of sender and client and deploy the contracts
            const { deployerSigner, clientSigner, tokenContract, yEarnContract, yVaultContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Transfer some token to client account
            await tokenContract.transfer(clientSigner.address, "10000000000")
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal("10000000000")
            // Get sender and client account token balance before deposit
            const senderTknBalBefDep = await tokenContract.balanceOf(deployerSigner.address)
            const clientTknBalBefDep = await tokenContract.balanceOf(clientSigner.address)
            // Mix and max deposit
            await tokenContract.approve(yfUSDTContract.address, "10000000000")
            await tokenContract.connect(clientSigner).approve(yfUSDTContract.address, "10000000000")
            await dvmUSDTContract.deposit(["123000000", 0])
            await dvmUSDTContract.connect(clientSigner).deposit([0, "212000000"])
            await dvmUSDTContract.deposit([0, "166000000"])
            await dvmUSDTContract.connect(clientSigner).deposit(["249000000", 0])
            await dvmUSDTContract.deposit(["132000000", "186000000"])
            await dvmUSDTContract.connect(clientSigner).deposit(["234000000", "269000000"])
            // Get Yearn Farmer earn and vault network fees of accounts
            const senderEarnDepFee = Math.floor(123000000*0.01)+Math.floor(132000000*0.01)
            const senderVaultDepFee = Math.floor(166000000*0.01)+Math.floor(186000000*0.01)
            const clientEarnDepFee = Math.floor(249000000*0.01)+Math.floor(234000000*0.01)
            const clientVaultDepFee = Math.floor(212000000*0.01)+Math.floor(269000000*0.01)
            // Check if deposit amount of accounts return correctly
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal((123000000+132000000)-senderEarnDepFee)
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal((166000000+186000000)-senderVaultDepFee)
            expect(await yfUSDTContract.getEarnDepositBalance(clientSigner.address)).to.equal((249000000+234000000)-clientEarnDepFee)
            expect(await yfUSDTContract.getVaultDepositBalance(clientSigner.address)).to.equal((212000000+269000000)-clientVaultDepFee)
            // Check if daoUSDT distribute to accounts correctly
            expect(await dvmUSDTContract.balanceOf(deployerSigner.address)).to.equal((123000000+132000000+166000000+186000000)-senderEarnDepFee-senderVaultDepFee)
            expect(await dvmUSDTContract.balanceOf(clientSigner.address)).to.equal((212000000+249000000+234000000+269000000)-clientEarnDepFee-clientVaultDepFee)
            // Get accounts token balance after deposit
            const senderTknBalAftDep = await tokenContract.balanceOf(deployerSigner.address)
            const clientTknBalAftDep = await tokenContract.balanceOf(clientSigner.address)
            // Check if token balance of accounts deduct correctly after deposit
            expect(senderTknBalAftDep).to.equal(senderTknBalBefDep.sub(123000000+132000000+166000000+186000000))
            expect(clientTknBalAftDep).to.equal(clientTknBalBefDep.sub(212000000+249000000+234000000+269000000))
            // Check if network fees send to treasury wallet correctly
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(senderEarnDepFee+senderVaultDepFee+clientEarnDepFee+clientVaultDepFee)
            // Get Yearn Farmer pool amount
            const yfPool = await yfUSDTContract.pool()
            // Check if Yearn Farmer pool amount sum up correctly
            expect(yfPool).to.equal(
                (await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).add(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address))
                .add(await yfUSDTContract.getEarnDepositBalance(clientSigner.address)).add(await yfUSDTContract.getVaultDepositBalance(clientSigner.address))
            )
            // Mix and max withdraw
            await dvmUSDTContract.withdraw(["200000000", 0])
            await dvmUSDTContract.connect(clientSigner).withdraw(["132000000", 0])
            await dvmUSDTContract.withdraw([0, "24000000"])
            await dvmUSDTContract.connect(clientSigner).withdraw([0, "188000000"])
            // Get earn and vault deposit balance of accounts
            const senderEarnDepBalAftWdr = await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)
            const senderVaultDepBalAftWdr = await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)
            const clientEarnDepBalAftWdr = await yfUSDTContract.getEarnDepositBalance(clientSigner.address)
            const clientVaultDepBalAftWdr = await yfUSDTContract.getVaultDepositBalance(clientSigner.address)
            // Check if deposit amount of accounts return correctly after withdraw 1st time
            expect(senderEarnDepBalAftWdr).to.equal((123000000+132000000)-senderEarnDepFee-200000000)
            expect(senderVaultDepBalAftWdr).to.equal((166000000+186000000)-senderVaultDepFee-24000000)
            expect(clientEarnDepBalAftWdr).to.equal((249000000+234000000)-clientEarnDepFee-132000000)
            expect(clientVaultDepBalAftWdr).to.equal((212000000+269000000)-clientVaultDepFee-188000000)
            // Check if daoUSDT burn correctly in accounts
            expect(await dvmUSDTContract.balanceOf(deployerSigner.address)).to.equal((123000000+132000000+166000000+186000000)-Math.floor(123000000*0.01)-Math.floor(132000000*0.01)-Math.floor(166000000*0.01)-Math.floor(186000000*0.01)-(200000000+24000000))
            expect(await dvmUSDTContract.balanceOf(clientSigner.address)).to.equal((212000000+249000000+234000000+269000000)-Math.floor(212000000*0.01)-Math.floor(249000000*0.01)-Math.floor(234000000*0.01)-Math.floor(269000000*0.01)-(132000000+188000000))
            // Get accounts token balance after withdraw 1st time
            const senderTknBalAftWdr = await tokenContract.balanceOf(deployerSigner.address)
            const clientTknBalAftWdr = await tokenContract.balanceOf(clientSigner.address)
            // Get total withdraw amount of sender and client in big number
            const senderEarnWdrAmt = new ethers.BigNumber.from("200000000")
            const senderVaultWdrAmt = new ethers.BigNumber.from("24000000")
            const clientEarnWdrAmt = new ethers.BigNumber.from("132000000")
            const clientVaultWdrAmt = new ethers.BigNumber.from("188000000")
            // Get off-chain actual withdraw USDT amount based on Yearn Earn and Vault contract
            let senderEarnSharesinYearnContract = (senderEarnWdrAmt.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            let senderActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(senderEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            let senderVaultSharesinYearnContract = (senderVaultWdrAmt.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            let senderActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(senderVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            let clientEarnSharesinYearnContract = (clientEarnWdrAmt.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            let clientActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            let clientVaultSharesinYearnContract = (clientVaultWdrAmt.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            let clientActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            // Check if token balance of accounts top-up correctly after withdraw
            expect(senderTknBalAftWdr).to.equal(senderTknBalAftDep.add(senderActualEarnWithdrawAmount).add(senderActualVaultWithdrawAmount))
            expect(clientTknBalAftWdr).to.equal(clientTknBalAftDep.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount).sub(1)) // Sometimes this will failed because of very small variation
            // Check if Yearn Contract pool amount deduct correctly
            expect(await yfUSDTContract.pool()).to.equal(yfPool.sub(senderEarnWdrAmt.add(senderVaultWdrAmt).add(clientEarnWdrAmt).add(clientVaultWdrAmt)))
            // Get shares based on deposit
            const senderDaoEarnShares = (await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).mul(await dvmUSDTContract.totalSupply()).div(await yfUSDTContract.pool())
            const senderDaoVaultUSDTShares = (await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).mul(await dvmUSDTContract.totalSupply()).div(await yfUSDTContract.pool())
            const clientDaoEarnShares = (await yfUSDTContract.getEarnDepositBalance(clientSigner.address)).mul(await dvmUSDTContract.totalSupply()).div(await yfUSDTContract.pool())
            const clientDaoVaultUSDTShares = (await yfUSDTContract.getVaultDepositBalance(clientSigner.address)).mul(await dvmUSDTContract.totalSupply()).div(await yfUSDTContract.pool())
            // Withdraw all balance for accounts in Yearn contract 
            await dvmUSDTContract.withdraw([senderDaoEarnShares, 0])
            await dvmUSDTContract.connect(clientSigner).withdraw([clientDaoEarnShares, 0])
            await dvmUSDTContract.withdraw([0, senderDaoVaultUSDTShares])
            await dvmUSDTContract.connect(clientSigner).withdraw([0, clientDaoVaultUSDTShares])
            // Check if deposit amount of accounts return 0
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(0)
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(0)
            expect(await yfUSDTContract.getEarnDepositBalance(clientSigner.address)).to.equal(0)
            expect(await yfUSDTContract.getVaultDepositBalance(clientSigner.address)).to.equal(0)
            // Check if daoUSDT burn to empty in accounts
            expect(await dvmUSDTContract.balanceOf(deployerSigner.address)).to.equal(0)
            expect(await dvmUSDTContract.balanceOf(clientSigner.address)).to.equal(0)
            // Get off-chain actual withdraw USDT amount based on Yearn Earn and Vault contract
            senderEarnSharesinYearnContract = (senderEarnDepBalAftWdr.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            senderActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(senderEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            senderVaultSharesinYearnContract = (senderVaultDepBalAftWdr.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            senderActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(senderVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            clientEarnSharesinYearnContract = (clientEarnDepBalAftWdr.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            clientActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            clientVaultSharesinYearnContract = (clientVaultDepBalAftWdr.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            clientActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            // Check if token balance of accounts top-up correctly after withdraw all
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.equal(senderTknBalAftWdr.add(senderActualEarnWithdrawAmount).add(senderActualVaultWithdrawAmount).sub(1)) // Sometimes this will failed because of very small variation
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(clientTknBalAftWdr.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount))
            // Check if Yearn Contract pool amount return 0
            expect(await yfUSDTContract.pool()).to.equal(0)
        })

        it("should able to deal with mix and match situation (deposit and withdraw several times in tier 2)", async () => {
            // Get signer and address of sender and deploy the contracts
            const { deployerSigner, tokenContract, yEarnContract, yVaultContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Approve Yearn Farmer to transfer token from sender
            await tokenContract.approve(yfUSDTContract.address, "1000000000000")
            // Get current balance USDT of sender account
            const tokenBalanceBeforeDeposit = await tokenContract.balanceOf(deployerSigner.address)
            // Mix and max deposit and withdraw
            const depositAmount1 = ethers.BigNumber.from("62345000000")
            const depositAmount2 = ethers.BigNumber.from("97822000000")
            const depositAmount3 = ethers.BigNumber.from("4444000000")
            const depositAmount4 = ethers.BigNumber.from("22222000000")
            await dvmUSDTContract.deposit([depositAmount1, depositAmount4])
            const withdrawAmount1 = ethers.BigNumber.from("8932000000")
            let senderSharesinYearnContract = (new ethers.BigNumber.from(withdrawAmount1)).mul(await yEarnContract.totalSupply()).div(await yEarnContract.calcPoolValueInToken())
            let senderActualWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(senderSharesinYearnContract)).div(await yEarnContract.totalSupply())
            await dvmUSDTContract.withdraw([withdrawAmount1, 0])
            await dvmUSDTContract.deposit([depositAmount2, 0])
            await dvmUSDTContract.deposit([depositAmount3, 0])
            let currentTokenBalance = tokenBalanceBeforeDeposit.sub(depositAmount1).sub(depositAmount4).add(senderActualWithdrawAmount).sub("97822000000").sub(depositAmount3)
            const withdrawAmount2 = ethers.BigNumber.from("7035000000")
            senderSharesinYearnContract = (new ethers.BigNumber.from(withdrawAmount2)).mul(await yEarnContract.totalSupply()).div(await yEarnContract.calcPoolValueInToken())
            senderActualWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(senderSharesinYearnContract)).div(await yEarnContract.totalSupply())
            await dvmUSDTContract.withdraw([withdrawAmount2, 0])
            currentTokenBalance = currentTokenBalance.add(senderActualWithdrawAmount)
            const withdrawAmount3 = ethers.BigNumber.from("19965000000")
            senderSharesinYearnContract = (new ethers.BigNumber.from(withdrawAmount3)).mul(await yVaultContract.totalSupply()).div(await yVaultContract.balance())
            senderActualWithdrawAmount = ((await yVaultContract.balance()).mul(senderSharesinYearnContract)).div(await yVaultContract.totalSupply())
            await dvmUSDTContract.withdraw([0, withdrawAmount3])
            const depositAmount5 = ethers.BigNumber.from("59367000000")
            await dvmUSDTContract.deposit([0, depositAmount5])
            currentTokenBalance = currentTokenBalance.add(senderActualWithdrawAmount).sub(depositAmount5)
            // Check if balance token of sender account correctly after mix and max deposit and withdraw
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.equal(currentTokenBalance) // Sometimes this will failed because of very small variation
            // Check if earn and vault deposit balance return correctly
            const earnDepositBalance = (depositAmount1.sub(depositAmount1.mul(75).div(10000))).add(depositAmount2.sub(depositAmount2.mul(75).div(10000))).add(depositAmount3.sub(depositAmount3.mul(100).div(10000))).sub(withdrawAmount1).sub(withdrawAmount2)
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(earnDepositBalance)
            const vaultDepositBalance = (depositAmount4.sub(depositAmount4.mul(75).div(10000))).add(depositAmount5.sub(depositAmount5.mul(75).div(10000)).sub(withdrawAmount3))
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(vaultDepositBalance)
            // Check if daoUSDT balance of sender account correct
            expect(await dvmUSDTContract.balanceOf(deployerSigner.address)).to.equal(earnDepositBalance.add(vaultDepositBalance))
            // Check if treasury wallet receive fees amount correctly
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal((depositAmount1.mul(75).div(10000)).add(depositAmount2.mul(75).div(10000)).add(depositAmount4.mul(75).div(10000)).add(depositAmount3*0.01).add(depositAmount5.mul(75).div(10000)))
            // Check if Yearn Farmer pool amount correct
            expect(await yfUSDTContract.pool()).to.equal((depositAmount1.sub(depositAmount1.mul(75).div(10000))).add(depositAmount2.sub(depositAmount2.mul(75).div(10000))).sub(withdrawAmount1).add(depositAmount4.sub(depositAmount4.mul(75).div(10000))).add(depositAmount3.sub(depositAmount3.mul(100).div(10000))).sub(withdrawAmount2).sub(withdrawAmount3).add(depositAmount5.sub(depositAmount5.mul(75).div(10000))))
        })

        it("should able to refund token when this contract is in vesting state", async () => {
            // Get address of owner and deploy the contracts
            const { clientSigner, tokenContract, yEarnContract, yVaultContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Transfer some token to client
            await tokenContract.transfer(clientSigner.address, "1000000000")
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await tokenContract.connect(clientSigner).approve(yfUSDTContract.address, ethers.utils.parseEther("1"))
            await dvmUSDTContract.connect(clientSigner).deposit(["100000000", "200000000"])
            // Get client USDT balance before refund
            const tokenBalanceBeforeRefund = await tokenContract.balanceOf(clientSigner.address)
            // Get client earn and vault deposit balance return before vesting
            const clientEarnDepositBalanceBeforeVesting = await yfUSDTContract.getEarnDepositBalance(clientSigner.address)
            const clientVaultDepositBalanceBeforeVesting = await yfUSDTContract.getVaultDepositBalance(clientSigner.address)
            // Get client off-chain actual earn withdraw amount
            const clientEarnSharesinYearnContract = (clientEarnDepositBalanceBeforeVesting).mul(await yEarnContract.totalSupply()).div(await yEarnContract.calcPoolValueInToken())
            const clientActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            const clientVaultSharesinYearnContract = (clientVaultDepositBalanceBeforeVesting).mul(await yVaultContract.totalSupply()).div(await yVaultContract.balance())
            const clientActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            // Execute vesting function
            await yfUSDTContract.vesting()
            // Check if function to get shares value return correctly
            expect(await yfUSDTContract.getSharesValue(clientSigner.address)).to.gte(clientActualEarnWithdrawAmount.add(clientActualVaultWithdrawAmount))
            // Check if refund function meet requirements
            await expect(dvmUSDTContract.refund()).to.be.revertedWith("No balance to refund")
            await expect(yfUSDTContract.refund("100000000")).to.be.revertedWith("Only can call from Vault")
            // Execute refund function
            await dvmUSDTContract.connect(clientSigner).refund()
            // Check if USDT amount of client refund correctly
            expect(await tokenContract.balanceOf(clientSigner.address)).to.gte(tokenBalanceBeforeRefund.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount))
            // Check if daoUSDT of client burn to 0
            expect(await dvmUSDTContract.balanceOf(clientSigner.address)).to.equal(0)
        })

        it("should able to refund token with profit when this contract is in vesting state", async () => {
            // Get address of owner and deploy the contracts
            const { deployerSigner, tokenContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Transfer some USDT to Yearn Farmer contract as profit from Yearn contract
            await tokenContract.transfer(yfUSDTContract.address, "1000000000")
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await tokenContract.approve(yfUSDTContract.address, "1000000000")
            await dvmUSDTContract.deposit(["100000000", "200000000"])
            // Get client USDT balance before refund
            const tokenBalanceBeforeRefund = await tokenContract.balanceOf(deployerSigner.address)
            // Execute vesting function
            await yfUSDTContract.vesting()
            // Get shares value before execute refund function
            const sharesValue = await yfUSDTContract.getSharesValue(deployerSigner.address)
            // Execute refund function
            await dvmUSDTContract.refund()
            // Check if refund token amount correctly
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.equal(tokenBalanceBeforeRefund.add(sharesValue))
            // Check if Yearn-Farmer pool equal to 0
            expect(await yfUSDTContract.pool()).to.equal(0)
            expect(await dvmUSDTContract.balanceOf(deployerSigner.address)).to.equal(0)
            expect(await yfUSDTContract.balanceOf(dvmUSDTContract.address)).to.equal(0)
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(0)
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(0)
            expect(await yfUSDTContract.getSharesValue(deployerSigner.address)).to.equal(0)
        })

        it("should approve Yearn Earn and Vault contract to deposit USDT from yfUSDT contract", async () => {
            // This function only execute one time and already execute while yfUSDT contract deployed.
            // User should ignore this function.

            // Get address of owner and deploy the contracts
            const { tokenContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Check if Yearn Earn and Vault contract can deposit a huge amount of USDT from yfUSDT contract
            await tokenContract.approve(yfUSDTContract.address, "500000000000000")
            await expect(dvmUSDTContract.deposit(["250000000000000", "250000000000000"])).not.to.be.reverted
        })
    })


    // Test admin functions
    describe("Admin functions", () => {
        it("should able to transfer contract ownership to other address by contract owner only", async () => {
            // Get address of owner and new owner and deploy the contracts
            const { deployerSigner, clientSigner, yfUSDTContract, dvmUSDTContract } = await setup()
            // Check if contract ownership is owner before transfer
            expect(await yfUSDTContract.owner()).to.equal(deployerSigner.address)
            expect(await dvmUSDTContract.owner()).to.equal(deployerSigner.address)
            // Check if new owner cannot execute admin functions yet
            await expect(dvmUSDTContract.connect(clientSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmUSDTContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmUSDTContract.connect(clientSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setVault(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setNetworkFeeTier2(["100000000", "200000000"])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setNetworkFeePercentage([30, 30, 30])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 13))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setCustomNetworkFeePercentage(20)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
            // Transfer contract ownership from owner to new owner
            await dvmUSDTContract.transferOwnership(clientSigner.address)
            await yfUSDTContract.transferOwnership(clientSigner.address)
            // Check if contract ownership is new owner after transfer
            expect(await dvmUSDTContract.owner()).to.equal(clientSigner.address)
            expect(await yfUSDTContract.owner()).to.equal(clientSigner.address)
            // Check if new owner can execute admin function
            await expect(dvmUSDTContract.connect(clientSigner).unlockMigrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmUSDTContract.connect(clientSigner).setPendingStrategy(deployerSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmUSDTContract.connect(clientSigner).migrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setVault(deployerSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setTreasuryWallet(deployerSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setNetworkFeeTier2(["100000000", "200000000"])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setNetworkFeePercentage([30, 30, 30])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 13))).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).setCustomNetworkFeePercentage(20)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(clientSigner).vesting()).not.to.be.revertedWith("Ownable: caller is not the owner")
            // Check if original owner neither can execute admin function nor transfer back ownership
            await expect(dvmUSDTContract.connect(deployerSigner).transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmUSDTContract.connect(deployerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmUSDTContract.connect(deployerSigner).setPendingStrategy(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmUSDTContract.connect(deployerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(deployerSigner).transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(deployerSigner).setVault(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(deployerSigner).setTreasuryWallet(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(deployerSigner).setNetworkFeeTier2(["100000000", "200000000"])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(deployerSigner).setNetworkFeePercentage([30, 30, 30])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(deployerSigner).setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 13))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(deployerSigner).setCustomNetworkFeePercentage(20)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfUSDTContract.connect(deployerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("should able to set pending strategy, migrate funds and set new strategy correctly in daoVaultUSDT contract", async () => {
            // Get address of deployer and deploy the contracts
            const { deployerSigner, tokenContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Set pending strategy
            const sampleContract_JSON = require("../build/SampleContract.json")
            const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvmUSDTContract.address, tokenContract.address])
            await dvmUSDTContract.setPendingStrategy(sampleContract.address)
            // Check if pending strategy is set with given address
            expect(await dvmUSDTContract.pendingStrategy()).to.equal(sampleContract.address)
            // Deposit into daoVaultUSDT and execute vesting function
            await tokenContract.approve(yfUSDTContract.address, "100000000000")
            await dvmUSDTContract.deposit(["1000000000", "2000000000"])
            await yfUSDTContract.vesting()
            // Get Yearn Farmer token balance before migrate
            const tokenBalance = await tokenContract.balanceOf(yfUSDTContract.address) 
            // Execute unlock migrate funds function
            await dvmUSDTContract.unlockMigrateFunds()
            // Check if execute migrate funds function before 2 days be reverted
            network.provider.send("evm_increaseTime", [86400]) // advance 1 day
            await expect(dvmUSDTContract.migrateFunds()).to.be.revertedWith("Function locked")
            network.provider.send("evm_increaseTime", [86400*2+60]) // advance another 2 days
            await expect(dvmUSDTContract.migrateFunds()).to.be.revertedWith("Function locked")
            // Execute unlock migrate funds function again
            await dvmUSDTContract.unlockMigrateFunds()
            network.provider.send("evm_increaseTime", [86400*2]) // advance for 2 days
            // Check if migrate funds function meet the requirements
            // await expect(dvmUSDTContract.migrateFunds()).to.be.revertedWith("No balance to migrate") // need to comment out deposit() function to test this
            // await expect(dvmUSDTContract.migrateFunds()).to.be.revertedWith("No pendingStrategy") // need to comment out set/check pending strategy function to test this
            // Approve for token transfer from Yearn Farmer to new strategy
            await yfUSDTContract.approveMigrate()
            // Check if migrate funds function is log
            await expect(dvmUSDTContract.migrateFunds()).to.emit(dvmUSDTContract, "MigrateFunds")
                .withArgs(yfUSDTContract.address, sampleContract.address, tokenBalance)
            // Check if token transfer correctly
            expect(await tokenContract.balanceOf(sampleContract.address)).to.equal(tokenBalance)
            expect(await tokenContract.balanceOf(yfUSDTContract.address)).to.equal(0)
            // Check if yfUSDT in daoVaultUSDT burn to 0
            expect(await yfUSDTContract.balanceOf(dvmUSDTContract.address)).to.equal(0)
            // Check if new strategy set and pending strategy reset to 0
            expect(await dvmUSDTContract.strategy()).to.equal(sampleContract.address)
            expect(await dvmUSDTContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
            // Check if execute migrate funds function again be reverted
            await expect(dvmUSDTContract.migrateFunds()).to.be.revertedWith("Function locked")
        })

        it("should able to set new treasury wallet correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and new treasury wallet and deploy the contracts
            const [_, newTreasuryWalletSigner] = await ethers.getSigners()
            const { tokenContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Set new treasury wallet
            // Check if event for setTreasuryWallet function is logged
            await expect(yfUSDTContract.setTreasuryWallet(newTreasuryWalletSigner.address))
                .to.emit(yfUSDTContract, "SetTreasuryWallet")
                .withArgs(treasuryWalletAddress, newTreasuryWalletSigner.address)
            // Check if new treasury wallet is set to the contract
            expect(await yfUSDTContract.treasuryWallet()).to.equal(newTreasuryWalletSigner.address)
            // Check if new treasury wallet receive fees
            await tokenContract.approve(yfUSDTContract.address, "1000000000")
            await dvmUSDTContract.deposit(["100000000", "200000000"])
            // - 100 + 200 < 300 within network fee tier 1 hence fee = 1%
            expect(await tokenContract.balanceOf(newTreasuryWalletSigner.address)).to.equal("3000000")
        })

        it("should able to set new community wallet correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and new community wallet and deploy the contracts
            const [_, newCommunityWalletSigner] = await ethers.getSigners()
            const yfUSDTContract = await ethers.getContract("YearnFarmerUSDTv2")
            // Set new community wallet
            // Check if event for setCommunityWallet function is logged
            await expect(yfUSDTContract.setCommunityWallet(newCommunityWalletSigner.address))
                .to.emit(yfUSDTContract, "SetCommunityWallet")
                .withArgs(communityWalletAddress, newCommunityWalletSigner.address)
            // Check if new community wallet is set to the contract
            expect(await yfUSDTContract.communityWallet()).to.equal(newCommunityWalletSigner.address)
        })

        it("should able to set new network fee tier correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfUSDTContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(yfUSDTContract.setNetworkFeeTier2([0, "10000000000"]))
                .to.be.revertedWith("Minimun amount cannot be 0")
            await expect(yfUSDTContract.setNetworkFeeTier2(["10000000000", "10000000000"]))
                .to.be.revertedWith("Maximun amount must greater than minimun amount")
            // Set network fee tier 2 with minimun 60001 and maximun 600000 (default 50001, 500000)
            // and Check if function is log
            await expect(yfUSDTContract.setNetworkFeeTier2(["60000000001", "600000000000"]))
                .to.emit(yfUSDTContract, "SetNetworkFeeTier2")
                .withArgs(["50000000001", "100000000000"], ["60000000001", "600000000000"]) // [oldNetworkFeeTier2, newNetworkFeeTier2]
            // Check if network fee tier 2 amount is set correctly
            expect(await yfUSDTContract.networkFeeTier2(0)).to.equal("60000000001")
            expect(await yfUSDTContract.networkFeeTier2(1)).to.equal("600000000000")
        })

        it("should able to set new custom network fee tier correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfUSDTContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(yfUSDTContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("1", 10)))
                .to.be.revertedWith("Custom network fee tier must greater than tier 2")
            // Set custom network fee tier to 2000000 (default 1000000)
            // and Check if function is log
            await expect(yfUSDTContract.setCustomNetworkFeeTier(ethers.utils.parseUnits("2", 12)))
                .to.emit(yfUSDTContract, "SetCustomNetworkFeeTier")
                .withArgs("1000000000000", "2000000000000") // [oldCustomNetworkFeeTier, newCustomNetworkFeeTier]
            // Check if custom network fee tier amount is set correctly
            expect(await yfUSDTContract.customNetworkFeeTier()).to.equal(ethers.utils.parseUnits("2", 12))
        })

        it("should able to set new network fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfUSDTContract } = await setup()
            // Check if function parameter meet the requirements (100 = 1%)
            await expect(yfUSDTContract.setNetworkFeePercentage([4000, 0, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 40%")
            await expect(yfUSDTContract.setNetworkFeePercentage([0, 4000, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 40%")
            await expect(yfUSDTContract.setNetworkFeePercentage([0, 0, 4000]))
                .to.be.revertedWith("Network fee percentage cannot be more than 40%")
            // Set network fee percentage to tier1 2%, tier2 1%, tier3 0.5% (default tier1 1%, tier2 0.5%, tier3 0.25%)
            // And check if function is log
            await expect(yfUSDTContract.setNetworkFeePercentage([200, 100, 50]))
                .to.emit(yfUSDTContract, "SetNetworkFeePercentage")
                .withArgs([100, 75, 50], [200, 100, 50]) // [oldNetworkFeePercentage, newNetworkFeePercentage]
            // Check if network fee percentage is set correctly
            expect(await yfUSDTContract.networkFeePercentage(0)).to.equal(200)
            expect(await yfUSDTContract.networkFeePercentage(1)).to.equal(100)
            expect(await yfUSDTContract.networkFeePercentage(2)).to.equal(50)
        })

        it("should able to set new custom network fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfUSDTContract } = await setup()
            // Check if function parameter meet the requirements (100 = 1%)
            await expect(yfUSDTContract.setCustomNetworkFeePercentage(60))
                .to.be.revertedWith("Custom network fee percentage cannot be more than tier 2")
            // Set network fee percentage to 0.1% (default 0.25%)
            // And check if function is log
            await expect(yfUSDTContract.setCustomNetworkFeePercentage(10))
                .to.emit(yfUSDTContract, "SetCustomNetworkFeePercentage")
                .withArgs(25, 10) // [oldCustomNetworkFeePercentage, newCustomNetworkFeePercentage]
            // Check if network fee percentage is set correctly
            expect(await yfUSDTContract.customNetworkFeePercentage()).to.equal(10)
        })

        it("should able to set new profile sharing fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfUSDTContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(yfUSDTContract.setProfileSharingFeePercentage(4000))
                .to.be.revertedWith("Profile sharing fee percentage cannot be more than 40%")
            // Set profile sharing fee percentage to 20% (default 10%) and check if function log
            await expect(yfUSDTContract.setProfileSharingFeePercentage(2000))
                .to.emit(yfUSDTContract, "SetProfileSharingFeePercentage")
                .withArgs(1000, 2000) // [oldProfileSharingFeePercentage, newProfileSharingFeePercentage]
            // Check if profile sharing fee percentage is set correctly
            expect(await yfUSDTContract.profileSharingFeePercentage()).to.equal(2000)
        })

        it("should set contract in vesting state correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { deployerSigner, tokenContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Deposit into Yearn Farmer through daoVaultUSDT
            await tokenContract.approve(yfUSDTContract.address, "1000000000")
            await dvmUSDTContract.deposit(["100000000", "200000000"])
            // Check if get shares value return 0 if no vesting (this function only available after vesting state)
            expect(await yfUSDTContract.getSharesValue(deployerSigner.address)).to.equal(0)
            // Check if corresponding function to be reverted if no vesting (these function only available after vesting state)
            await expect(dvmUSDTContract.refund()).to.be.revertedWith("Not in vesting state")
            await expect(yfUSDTContract.approveMigrate()).to.be.revertedWith("Not in vesting state")
            await yfUSDTContract.vesting()
            // Check if vesting state is true
            expect(await yfUSDTContract.isVesting()).is.true
            // Check if corresponding function to be reverted in vesting state
            await expect(dvmUSDTContract.deposit(["100000000", "200000000"])).to.be.revertedWith("Contract in vesting state")
            await expect(dvmUSDTContract.withdraw(["50000000", "100000000"])).to.be.revertedWith("Contract in vesting state")
            // Check if corresponding getter function return 0 in vesting state
            expect(await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)).to.equal(0) 
            expect(await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)).to.equal(0) 
            // Check if execute vesting function again to be reverted
            await expect(yfUSDTContract.vesting()).to.be.revertedWith("Already in vesting state")
            // Check if pool reset to 0 after vesting state
            expect(await yfUSDTContract.pool()).to.equal(0)
        })

        it("should send profit to treasury and community wallet correctly after vesting state in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { deployerSigner, tokenContract, yEarnContract, yVaultContract, yfUSDTContract, dvmUSDTContract } = await setup()
            // Deposit into Yearn Farmer through daoVaultUSDT
            await tokenContract.approve(yfUSDTContract.address, "1000000000")
            await dvmUSDTContract.deposit(["100000000", "200000000"])
            const treasuryWalletBalanceBeforeVesting = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityWalletBalanceBeforeVesting = await tokenContract.balanceOf(communityWalletAddress)
            // Get off-chain Yearn earn and vault actual withdraw amount
            const earnDepositBalance = await yfUSDTContract.getEarnDepositBalance(deployerSigner.address)
            const vaultDepositBalance = await yfUSDTContract.getVaultDepositBalance(deployerSigner.address)
            const offChainActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(
                (earnDepositBalance.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken()))
            ).div(await yEarnContract.totalSupply())
            const offChainActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(
                (vaultDepositBalance.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance()))
            ).div(await yVaultContract.totalSupply())
            // Transfer some token to Yearn Farmer contract treat as profit
            await tokenContract.transfer(yfUSDTContract.address, "100000000")
            await yfUSDTContract.vesting()
            // Check if balance token in Yearn Farmer contract correctly after fee
            expect(await tokenContract.balanceOf(yfUSDTContract.address)).to.equal(await yfUSDTContract.getSharesValue(deployerSigner.address))
            // Check if amount fee transfer to treasury and community wallet correctly (50% split)
            const profit = (await tokenContract.balanceOf(yfUSDTContract.address)).sub(offChainActualEarnWithdrawAmount.add(offChainActualVaultWithdrawAmount))
            const profileSharingFee = profit.mul(10).div(100)
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.gte(treasuryWalletBalanceBeforeVesting.add(profileSharingFee.mul(50).div(100)))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.gte(communityWalletBalanceBeforeVesting.add(profileSharingFee.mul(50).div(100)))
        })
    })
})
