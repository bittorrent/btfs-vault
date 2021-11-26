const {
  BN,
  constants,
  expectRevert
} = require("@openzeppelin/test-helpers");

  
const { expect } = require('chai');
const ChequeBookFactory = artifacts.require('ChequeBookFactory')
const ChequeBook = artifacts.require('ChequeBook')
const TestToken = artifacts.require("TestToken")

contract('ChequeBookFactory', function([issuer, other]) {
  
  const salt = "0x000000000000000000000000000000000000000000000000000000000000abcd"
  function shouldDeployChequeBook(issuer, value) {

    beforeEach(async function() {
      this.TestToken = await TestToken.new({from: issuer})
      this.chequeBookFactory = await ChequeBookFactory.new(this.TestToken.address)
      let { logs } = await this.chequeBookFactory.deployChequeBook(issuer, salt)
      this.ChequeBookAddress = logs[0].args.contractAddress
      this.ChequeBook = await ChequeBook.at(this.ChequeBookAddress)
      if(value != 0) {
        await this.TestToken.mint(issuer, value) // mint tokens
        await this.TestToken.transfer(this.ChequeBook.address, value, {from: issuer}); // deposit those tokens in chequebook
      }
    })
  
    it('should allow other addresses to deploy with same salt', async function() {
      await this.chequeBookFactory.deployChequeBook(issuer, salt, { from: other })
    })

    it('should deploy with the right issuer', async function() {
      expect(await this.ChequeBook.issuer()).to.be.equal(issuer)
    })
  
    if(value.gtn(0)) {
      it('should forward the deposit to ChequeBook', async function() {
        expect(await this.ChequeBook.totalbalance()).to.bignumber.equal(value)
      })
    }
  
    it('should record the deployed address', async function() {
      expect(await this.chequeBookFactory.deployedContracts(this.ChequeBookAddress)).to.be.true
    })
  
    it('should have set the ERC20 address correctly', async function() {
      expect(await this.ChequeBook.token()).to.be.equal(this.TestToken.address)
    })
  }
    
  describe('when we deploy ChequeBook', function() {
    describe("when we don't deposit while deploying ChequeBook", function() {
      this.timeout(100000);
      shouldDeployChequeBook(issuer, new BN(0))
    })
    
    describe("when we deposit while deploying ChequeBook", function() {
      this.timeout(100000);
      shouldDeployChequeBook(issuer, new BN(10))
    })

    describe("when we deposit while issuer 0", function() {
      this.timeout(100000);
      it('should fail', async function() {
        this.TestToken = await TestToken.new({from: issuer})
        this.chequeBookFactory = await ChequeBookFactory.new(this.TestToken.address)
        await expectRevert(this.chequeBookFactory.deployChequeBook(constants.ZERO_ADDRESS, salt), 'invalid issuer')
      })
    })
  })
})