const {
  BN,
  constants,
  expectRevert
} = require("@openzeppelin/test-helpers");

  
const { expect } = require('chai');
const VaultFactory = artifacts.require('VaultFactory')
const Vault = artifacts.require('Vault')
const TestToken = artifacts.require("TestToken")

contract('VaultFactory', function([issuer, other]) {
  
  const salt = "0x000000000000000000000000000000000000000000000000000000000000abcd"
  function shouldDeployVault(issuer, value) {

    beforeEach(async function() {
      this.TestToken = await TestToken.new({from: issuer})
      this.vaultFactory = await VaultFactory.new(this.TestToken.address)
      let { logs } = await this.vaultFactory.deployVault(issuer, salt)
      this.VaultAddress = logs[0].args.contractAddress
      this.Vault = await Vault.at(this.VaultAddress)
      if(value != 0) {
        await this.TestToken.mint(issuer, value) // mint tokens
        await this.TestToken.transfer(this.Vault.address, value, {from: issuer}); // deposit those tokens in vault
      }
    })
  
    it('should allow other addresses to deploy with same salt', async function() {
      await this.vaultFactory.deployVault(issuer, salt, { from: other })
    })

    it('should deploy with the right issuer', async function() {
      expect(await this.Vault.issuer()).to.be.equal(issuer)
    })
  
    if(value.gtn(0)) {
      it('should forward the deposit to Vault', async function() {
        expect(await this.Vault.totalbalance()).to.bignumber.equal(value)
      })
    }
  
    it('should record the deployed address', async function() {
      expect(await this.vaultFactory.deployedContracts(this.VaultAddress)).to.be.true
    })
  
    it('should have set the ERC20 address correctly', async function() {
      expect(await this.Vault.token()).to.be.equal(this.TestToken.address)
    })
  }
    
  describe('when we deploy Vault', function() {
    describe("when we don't deposit while deploying Vault", function() {
      this.timeout(100000);
      shouldDeployVault(issuer, new BN(0))
    })
    
    describe("when we deposit while deploying Vault", function() {
      this.timeout(100000);
      shouldDeployVault(issuer, new BN(10))
    })

    describe("when we deposit while issuer 0", function() {
      this.timeout(100000);
      it('should fail', async function() {
        this.TestToken = await TestToken.new({from: issuer})
        this.vaultFactory = await VaultFactory.new(this.TestToken.address)
        await expectRevert(this.vaultFactory.deployVault(constants.ZERO_ADDRESS, salt), 'invalid issuer')
      })
    })
  })
})