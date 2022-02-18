const {
  BN,
  constants,
  expectRevert
} = require("@openzeppelin/test-helpers");


const { expect } = require('chai');
const VaultFactory = artifacts.require('VaultFactory')
const Vault = artifacts.require('Vault')
const TestToken = artifacts.require("TestToken")

contract('VaultFactory', function ([issuer, other1, other2]) {

  const salt = "0x000000000000000000000000000000000000000000000000000000000000abcd"
  const adminPeerID = "0000000000000000000000000000000000000000000000000000a"
  const userPeerID1 = "0000000000000000000000000000000000000000000000000000b"
  const userPeerID2 = "0000000000000000000000000000000000000000000000000000c"

  function shouldDeployVault(issuer, value) {

    beforeEach(async function () {
      let vaultImpl = await Vault.new({ from: issuer })
      this.vaultImpl = vaultImpl.address
      this.TestToken = await TestToken.new({ from: issuer })
      this.vaultFactory = await VaultFactory.new(this.TestToken.address)

      let vaultABI = new ethers.utils.Interface(Vault.abi)
      this.vaultInitData = vaultABI.encodeFunctionData('init', [issuer, this.TestToken.address])

      let { logs } = await this.vaultFactory.deployVault(issuer, this.vaultImpl, salt, adminPeerID, this.vaultInitData)
      this.VaultAddress = logs[0].args.contractAddress
      this.Vault = await Vault.at(this.VaultAddress)
      if (value != 0) {
        await this.TestToken.mint(issuer, value) // mint tokens
        await this.TestToken.transfer(this.Vault.address, value, { from: issuer }); // deposit those tokens in vault
      }
    })

    it('should deploy with the right issuer', async function () {
      expect(await this.Vault.issuer()).to.be.equal(issuer)
    })

    if (value.gtn(0)) {
      it('should forward the deposit to Vault', async function () {
        expect(await this.Vault.totalbalance()).to.bignumber.equal(value)
      })
    }

    it('should record the deployed address', async function () {
      expect(await this.vaultFactory.deployedContracts(this.VaultAddress)).to.be.true
    })

    it('should have set the ERC20 address correctly', async function () {
      expect(await this.Vault.token()).to.be.equal(this.TestToken.address)
    })

    it('should allow other addresses to deploy with same salt', async function () {
      let { logs } = await this.vaultFactory.deployVault(issuer, this.vaultImpl, salt, userPeerID1, this.vaultInitData, { from: other1 })
      const vaultAddr1 = logs[0].args.contractAddress
      expect(await this.vaultFactory.deployedContracts(vaultAddr1)).to.be.true
    })

    it("should record the relationship between peerID and it's vault address", async function () {
      await this.vaultFactory.deployVault(issuer, this.vaultImpl, salt, userPeerID1, this.vaultInitData, { from: other1 })
      await this.vaultFactory.deployVault(issuer, this.vaultImpl, salt, userPeerID2, this.vaultInitData, { from: other2 })
      const vaultAddr1 = await this.vaultFactory.peerVaultAddress(userPeerID1)
      const vaultAddr2 = await this.vaultFactory.peerVaultAddress(userPeerID2)
      expect(vaultAddr1).to.be.not.equal(vaultAddr2)
    })

  }

  describe('when we deploy Vault', function () {
    describe("when we don't deposit while deploying Vault", function () {
      this.timeout(100000);
      shouldDeployVault(issuer, new BN(0))
    })

    describe("when we deposit while deploying Vault", function () {
      this.timeout(100000);
      shouldDeployVault(issuer, new BN(10))
    })

    describe("when we deposit with zero issuer", function () {
      this.timeout(100000);
      it('should fail', async function () {
        this.vaultImpl = await Vault.new({ from: issuer })
        this.TestToken = await TestToken.new({ from: issuer })

        let vaultABI = new ethers.utils.Interface(Vault.abi)
        let vaultInitData = vaultABI.encodeFunctionData('init', [constants.ZERO_ADDRESS, this.TestToken.address])

        this.vaultFactory = await VaultFactory.new(this.TestToken.address)
        await expectRevert(this.vaultFactory.deployVault(constants.ZERO_ADDRESS, this.vaultImpl.address, salt, adminPeerID, vaultInitData), 'invalid issuer')
      })
    })
  })
})