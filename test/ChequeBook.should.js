const {
  BN,
  time,
  expectEvent,
  expectRevert
} = require("@openzeppelin/test-helpers");

const ChequeBook = artifacts.require('ChequeBook')
const ChequeBookFactory = artifacts.require('ChequeBookFactory')
const TestToken = artifacts.require("TestToken")

const { signCheque, signCashOut} = require("./swutils");
const { expect } = require('chai');

function shouldDeploy(issuer, value) {

  const salt = "0x000000000000000000000000000000000000000000000000000000000000abcd"

  beforeEach(async function() {
    this.TestToken = await TestToken.new({from: issuer})
    await this.TestToken.mint(issuer, 1000000000, {from: issuer});    
    this.chequeBookFactory = await ChequeBookFactory.new(this.TestToken.address)
    let { logs } = await this.chequeBookFactory.deployChequeBook(issuer, salt)
    this.ChequeBookAddress = logs[0].args.contractAddress
    this.ChequeBook = await ChequeBook.at(this.ChequeBookAddress)
    if(value != 0) {
      await this.TestToken.transfer(this.ChequeBook.address, value, {from: issuer});
    }
    this.postconditions = {
      issuer: await this.ChequeBook.issuer()
    }
  })

  it('should not allow a second init', async function() {
    await expectRevert(this.ChequeBook.init(issuer, this.TestToken.address), "revert")
  })

  it('should set the issuer', function() {
    expect(this.postconditions.issuer).to.be.equal(issuer)
  })
}

function shouldReturnPaidOut(beneficiary, expectedAmount) {
  beforeEach(async function() {
    this.paidOut = await this.ChequeBook.paidOut(beneficiary)
  })
  it('should return the expected amount', function() {
    expect(expectedAmount).bignumber.to.be.equal(this.paidOut)
  })
}

function shouldReturnTotalPaidOut(expectedAmount) {
  beforeEach(async function() {
    this.totalPaidOut = await this.ChequeBook.totalPaidOut()
  })
  it('should return the expected amount', function() {
    expect(expectedAmount).bignumber.to.be.equal(this.totalPaidOut)
  })
}

function shouldReturnIssuer(expectedIssuer) {
  it('should return the expected issuer', async function() {
    expect(await this.ChequeBook.issuer()).to.be.equal(expectedIssuer)
  })

}

function cashChequeInternal(beneficiary, recipient, cumulativePayout, callerPayout, from) {
  beforeEach(async function() {
    let requestPayout = cumulativePayout.sub(this.preconditions.paidOut)
    //if the requested payout is less than the chequebookBalance
    if(requestPayout.lt(this.preconditions.chequebookBalance)) {
      // full amount requested can be paid out
      this.totalPayout = requestPayout
    } else {
      // partial amount requested can be paid out
      this.totalPayout = this.preconditions.chequebookBalance
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
      chequebookBalance: await this.ChequeBook.totalbalance(),
      paidOut: await this.ChequeBook.paidOut(from),
      totalPaidOut: await this.ChequeBook.totalPaidOut()
    }

    const issuerSig = await signCheque(this.ChequeBook, from, cumulativePayout, signee)
  
    const { logs, receipt } = await this.ChequeBook.cashChequeBeneficiary(recipient, cumulativePayout, issuerSig, {from: from})
    this.logs = logs
    this.receipt = receipt
  
    this.postconditions = {
      callerBalance: await this.TestToken.balanceOf(from),
      recipientBalance: await this.TestToken.balanceOf(recipient),
      chequebookBalance: await this.ChequeBook.totalbalance(),
      paidOut: await this.ChequeBook.paidOut(from),
      totalPaidOut: await this.ChequeBook.totalPaidOut(),
      bounced: await this.ChequeBook.bounced()
    }
  })
  cashChequeInternal(from, recipient, cumulativePayout, new BN(0), from)
}
function shouldNotCashChequeBeneficiary(recipient, toSubmitCumulativePayout, toSignCumulativePayout, signee, from, value, revertMessage) {
  beforeEach(async function() {
    this.issuerSig = await signCheque(this.ChequeBook, from, toSignCumulativePayout, signee)
  })
  it('reverts', async function() {
    await expectRevert(this.ChequeBook.cashChequeBeneficiary(
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
    const beneficiarySig = await signCashOut(this.ChequeBook, from, cumulativePayout, recipient, callerPayout, beneficiarySignee)
    const issuerSig = await signCheque(this.ChequeBook, beneficiary, cumulativePayout, issuerSignee)
    this.preconditions = {
      callerBalance: await this.TestToken.balanceOf(from),
      recipientBalance: await this.TestToken.balanceOf(recipient),
      chequebookBalance: await this.ChequeBook.totalbalance(),
      paidOut: await this.ChequeBook.paidOut(beneficiary),
      totalPaidOut: await this.ChequeBook.totalPaidOut()
    }
    const { logs, receipt } = await this.ChequeBook.cashCheque(beneficiary, recipient, cumulativePayout, beneficiarySig, callerPayout, issuerSig, {from: from})
    this.logs = logs
    this.receipt = receipt
  
    this.postconditions = {
      callerBalance: await this.TestToken.balanceOf(from),
      recipientBalance: await this.TestToken.balanceOf(recipient),
      chequebookBalance: await this.ChequeBook.totalbalance(),
      paidOut: await this.ChequeBook.paidOut(beneficiary),
      totalPaidOut: await this.ChequeBook.totalPaidOut(),
      bounced: await this.ChequeBook.bounced()
    }
  })
  cashChequeInternal(beneficiary, recipient, cumulativePayout, callerPayout, from)
}
function shouldNotCashCheque(beneficiaryToSign, issuerToSign, toSubmitFields, value, from, beneficiarySignee, issuerSignee, revertMessage) {
  beforeEach(async function() {
    this.beneficiarySig = await signCashOut(this.ChequeBook, from, beneficiaryToSign.cumulativePayout, beneficiaryToSign.recipient, beneficiaryToSign.callerPayout, beneficiarySignee)
    this.issuerSig = await signCheque(this.ChequeBook, issuerToSign.beneficiary, issuerToSign.cumulativePayout, issuerSignee)
  })
  it('reverts', async function() {
    await expectRevert(this.ChequeBook.cashCheque(
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
      totalBalance: await this.ChequeBook.totalbalance()
    }

    await this.ChequeBook.withdraw(amount, {from: from})

    this.postconditions = {
      callerBalance: await  this.TestToken.balanceOf(from),
      totalBalance: await this.ChequeBook.totalbalance()
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
    await expectRevert(this.ChequeBook.withdraw(
      amount,
      {from: from, value: value}), 
      revertMessage
    )
  })
}

function shouldDeposit(amount, from) {
  beforeEach(async function() {
    this.preconditions = {
      balance: await this.ChequeBook.totalbalance(),
    }
    const { logs } = await this.TestToken.transfer(this.ChequeBook.address, amount, {from: from})
    this.logs = logs
  })
  it('should update the balance of the checkbook', async function() {
    expect(await this.ChequeBook.totalbalance()).bignumber.to.equal(this.preconditions.balance.add(amount))
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

