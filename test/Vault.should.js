const {
  BN,
  time,
  expectEvent,
  expectRevert
} = require("@openzeppelin/test-helpers");

const Vault = artifacts.require('Vault')
const VaultFactory = artifacts.require('VaultFactory')
const TestToken = artifacts.require("TestToken")

const { signCheque, signCashOut} = require("./utils");
const { expect } = require('chai');

function shouldDeploy(issuer, value) {

  const adminPeerID = "0000000000000000000000000000000000000000000000000000a"
  const salt = "0x000000000000000000000000000000000000000000000000000000000000abcd"

  beforeEach(async function() {
    let vaultImpl = await Vault.new({ from: issuer })
    this.vaultImpl = vaultImpl.address
    this.TestToken = await TestToken.new({from: issuer})
    await this.TestToken.mint(issuer, 1000000000, {from: issuer});    

    let vaultABI = new ethers.utils.Interface(Vault.abi)
    this.vaultInitData = vaultABI.encodeFunctionData('init', [issuer, this.TestToken.address])

    this.vaultFactory = await VaultFactory.new(this.TestToken.address)
    let { logs } = await this.vaultFactory.deployVault(issuer, this.vaultImpl, salt, adminPeerID, this.vaultInitData)
    this.VaultAddress = logs[0].args.contractAddress
    this.Vault = await Vault.at(this.VaultAddress)
    if(value != 0) {
      await this.TestToken.transfer(this.Vault.address, value, {from: issuer});
    }
    this.postconditions = {
      issuer: await this.Vault.issuer()
    }
  })

  it('should not allow a second init', async function() {
    await expectRevert(this.Vault.init(issuer, this.TestToken.address), "revert")
  })

  it('should set the issuer', function() {
    expect(this.postconditions.issuer).to.be.equal(issuer)
  })
}

function shouldReturnPaidOut(beneficiary, expectedAmount) {
  beforeEach(async function() {
    this.paidOut = await this.Vault.paidOut(beneficiary)
  })
  it('should return the expected amount', function() {
    expect(expectedAmount).bignumber.to.be.equal(this.paidOut)
  })
}

function shouldReturnTotalPaidOut(expectedAmount) {
  beforeEach(async function() {
    this.totalPaidOut = await this.Vault.totalPaidOut()
  })
  it('should return the expected amount', function() {
    expect(expectedAmount).bignumber.to.be.equal(this.totalPaidOut)
  })
}

function shouldReturnIssuer(expectedIssuer) {
  it('should return the expected issuer', async function() {
    expect(await this.Vault.issuer()).to.be.equal(expectedIssuer)
  })

}

function cashChequeInternal(beneficiary, recipient, cumulativePayout, callerPayout, from) {
  beforeEach(async function() {
    let requestPayout = cumulativePayout.sub(this.preconditions.paidOut)
    //if the requested payout is less than the vaultBalance
    if(requestPayout.lt(this.preconditions.vaultBalance)) {
      // full amount requested can be paid out
      this.totalPayout = requestPayout
    } else {
      // partial amount requested can be paid out
      this.totalPayout = this.preconditions.vaultBalance
    }
    this.totalPaidOut = this.preconditions.totalPaidOut + this.totalPayout
  })
  
  it('should update paidOut', async function() {
    expect(this.postconditions.paidOut).bignumber.to.be.equal(this.preconditions.paidOut.add(this.totalPayout))
  })

  it('should update totalPaidOut', async function() {
    expect(this.postconditions.totalPaidOut).bignumber.to.be.equal(this.preconditions.paidOut.add(this.totalPayout))
  })

  it('should transfer the correct amount to the recipient', async function() {
    expect(this.postconditions.recipientBalance).bignumber.to.be.equal(this.preconditions.recipientBalance.add(this.totalPayout.sub(callerPayout)))
  })
  it('should transfer the correct amount to the caller', async function() {
    let expectedAmountCaller
    if(recipient == from) {
      expectedAmountCaller = this.totalPayout
    } else {
      expectedAmountCaller = callerPayout
    }
    expect(this.postconditions.callerBalance).bignumber.to.be.equal(this.preconditions.callerBalance.add(expectedAmountCaller))
  })
  
  it('should emit a ChequeCashed event', function() {
    expectEvent.inLogs(this.logs, "ChequeCashed", {
      beneficiary,
      recipient: recipient,
      caller: from,
      totalPayout: this.totalPayout,
      cumulativePayout,
      callerPayout,
    })
  })
  it('should only emit a chequeBounced event when insufficient funds', function() {
    if(this.totalPayout.lt(cumulativePayout.sub(this.preconditions.paidOut))) {
      expectEvent.inLogs(this.logs, "ChequeBounced", {})
    } else {
      const events = this.logs.filter(e => e.event === 'ChequeBounced');
      expect(events.length > 0).to.equal(false, `There is a ChequeBounced event`)
    }
  })

  it('should only set the bounced field when insufficient funds', function() {
    if(this.totalPayout.lt(cumulativePayout.sub(this.preconditions.paidOut))) {
      expect(this.postconditions.bounced).to.be.true
    } else {
      expect(this.postconditions.bounced).to.be.false
    }
  })
}

function shouldCashChequeBeneficiary(recipient, cumulativePayout, signee, from) {
  beforeEach(async function() {
    this.preconditions = {
      callerBalance: await this.TestToken.balanceOf(from),
      recipientBalance: await this.TestToken.balanceOf(recipient),
      vaultBalance: await this.Vault.totalbalance(),
      paidOut: await this.Vault.paidOut(from),
      totalPaidOut: await this.Vault.totalPaidOut()
    }

    const issuerSig = await signCheque(this.Vault, from, cumulativePayout, signee)
  
    const { logs, receipt } = await this.Vault.cashChequeBeneficiary(recipient, cumulativePayout, issuerSig, {from: from})
    this.logs = logs
    this.receipt = receipt
  
    this.postconditions = {
      callerBalance: await this.TestToken.balanceOf(from),
      recipientBalance: await this.TestToken.balanceOf(recipient),
      vaultBalance: await this.Vault.totalbalance(),
      paidOut: await this.Vault.paidOut(from),
      totalPaidOut: await this.Vault.totalPaidOut(),
      bounced: await this.Vault.bounced()
    }
  })
  cashChequeInternal(from, recipient, cumulativePayout, new BN(0), from)
}
function shouldNotCashChequeBeneficiary(recipient, toSubmitCumulativePayout, toSignCumulativePayout, signee, from, value, revertMessage) {
  beforeEach(async function() {
    this.issuerSig = await signCheque(this.Vault, from, toSignCumulativePayout, signee)
  })
  it('reverts', async function() {
    await expectRevert(this.Vault.cashChequeBeneficiary(
      recipient,
      toSubmitCumulativePayout,
      this.issuerSig,
     {from: from, value: value}), 
     revertMessage
    )
  })
}

function shouldCashCheque(beneficiary, recipient, cumulativePayout, callerPayout, from, beneficiarySignee, issuerSignee) {
  beforeEach(async function() {
    const beneficiarySig = await signCashOut(this.Vault, from, cumulativePayout, recipient, callerPayout, beneficiarySignee)
    const issuerSig = await signCheque(this.Vault, beneficiary, cumulativePayout, issuerSignee)
    this.preconditions = {
      callerBalance: await this.TestToken.balanceOf(from),
      recipientBalance: await this.TestToken.balanceOf(recipient),
      vaultBalance: await this.Vault.totalbalance(),
      paidOut: await this.Vault.paidOut(beneficiary),
      totalPaidOut: await this.Vault.totalPaidOut()
    }
    const { logs, receipt } = await this.Vault.cashCheque(beneficiary, recipient, cumulativePayout, beneficiarySig, callerPayout, issuerSig, {from: from})
    this.logs = logs
    this.receipt = receipt
  
    this.postconditions = {
      callerBalance: await this.TestToken.balanceOf(from),
      recipientBalance: await this.TestToken.balanceOf(recipient),
      vaultBalance: await this.Vault.totalbalance(),
      paidOut: await this.Vault.paidOut(beneficiary),
      totalPaidOut: await this.Vault.totalPaidOut(),
      bounced: await this.Vault.bounced()
    }
  })
  cashChequeInternal(beneficiary, recipient, cumulativePayout, callerPayout, from)
}

function shouldNotCashCheque(beneficiaryToSign, issuerToSign, toSubmitFields, value, from, beneficiarySignee, issuerSignee, revertMessage) {
  beforeEach(async function() {
    this.beneficiarySig = await signCashOut(this.Vault, from, beneficiaryToSign.cumulativePayout, beneficiaryToSign.recipient, beneficiaryToSign.callerPayout, beneficiarySignee)
    this.issuerSig = await signCheque(this.Vault, issuerToSign.beneficiary, issuerToSign.cumulativePayout, issuerSignee)
  })
  it('reverts', async function() {
    await expectRevert(this.Vault.cashCheque(
      toSubmitFields.beneficiary, 
      toSubmitFields.recipient, 
      toSubmitFields.cumulativePayout, 
      this.beneficiarySig, 
      toSubmitFields.callerPayout,
      this.issuerSig,
      {from: from, value: value}), 
      revertMessage
    )
  })
}

function shouldWithdraw(amount, from) {
  beforeEach(async function() {
    this.preconditions = {
      callerBalance: await this.TestToken.balanceOf(from),
      totalBalance: await this.Vault.totalbalance()
    }

    await this.Vault.withdraw(amount, {from: from})

    this.postconditions = {
      callerBalance: await  this.TestToken.balanceOf(from),
      totalBalance: await this.Vault.totalbalance()
    }
  })

  it('should have updated the totalBalance', function() {
    expect(this.postconditions.totalBalance).bignumber.to.be.equal(this.preconditions.totalBalance.sub(amount))
  })

  it('should have updated the callerBalance', function() {
    expect(this.postconditions.callerBalance).bignumber.to.be.equal(this.preconditions.callerBalance.add(amount))
  })
}
function shouldNotWithdraw(amount, from, value, revertMessage) {
  it('reverts', async function() {
    await expectRevert(this.Vault.withdraw(
      amount,
      {from: from, value: value}), 
      revertMessage
    )
  })
}

function shouldDeposit(amount, from) {
  beforeEach(async function() {
    this.preconditions = {
      balance: await this.Vault.totalbalance(),
    }
    const { logs } = await this.TestToken.transfer(this.Vault.address, amount, {from: from})
    this.logs = logs
  })
  it('should update the balance of the vault', async function() {
    expect(await this.Vault.totalbalance()).bignumber.to.equal(this.preconditions.balance.add(amount))
  })
}
module.exports = {
  shouldDeploy,
  shouldReturnPaidOut,
  shouldReturnTotalPaidOut,
  shouldReturnIssuer,
  shouldCashChequeBeneficiary,
  shouldNotCashChequeBeneficiary,
  shouldCashCheque,
  shouldNotCashCheque,
  shouldWithdraw,
  shouldNotWithdraw,
  shouldDeposit,
}

