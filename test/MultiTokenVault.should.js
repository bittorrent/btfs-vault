const {
  BN,
  time,
  expectEvent,
  expectRevert
} = require("@openzeppelin/test-helpers");

const Vault = artifacts.require('Vault');
const MultiTokenVault = artifacts.require('MultiTokenVault');
const VaultV2 = artifacts.require('VaultV2');
const VaultProxy = artifacts.require('VaultProxy');
const VaultFactory = artifacts.require('VaultFactory');
const TestToken = artifacts.require("TestToken");

const { signMultiTokenCheque} = require("./utils");
const { expect } = require('chai');

function shouldUpgradeFromVault(issuer, value) {
  const adminPeerID = "0000000000000000000000000000000000000000000000000000a";
  const salt = "0x000000000000000000000000000000000000000000000000000000000000abcd";

  beforeEach(async function() {
    let vaultImpl = await Vault.new({ from: issuer });
    let vaultImplV2 = await VaultV2.new({ from: issuer });
    this.vaultImpl = vaultImpl.address;
    this.vaultImplV2 = vaultImplV2.address;
    this.TestToken = await TestToken.new({ from: issuer });
    await this.TestToken.mint(issuer, 1000000000, { from: issuer });
    this.TestToken2 = await TestToken.new({ from: issuer });
    await this.TestToken2.mint(issuer, 1000000000, { from: issuer });

    let vaultABI = new ethers.utils.Interface(MultiTokenVault.abi);
    this.vaultInitData = vaultABI.encodeFunctionData('init', [issuer, this.TestToken.address]);

    this.vaultFactory = await VaultFactory.new(this.TestToken.address);
    let { logs } = await this.vaultFactory.deployVault(issuer, this.vaultImpl, salt, adminPeerID, this.vaultInitData);
    this.VaultAddress = logs[0].args.contractAddress;
    this.Vault = await Vault.at(this.VaultAddress);
    this.VaultProxy = await VaultProxy.at(this.VaultAddress);

    if (value !== 0) {
      await this.TestToken.transfer(this.Vault.address, value, { from: issuer });
      await this.TestToken2.transfer(this.Vault.address, value, { from: issuer });
    }

    this.postconditions = {
      issuer: await this.Vault.issuer()
    };

    let multiTokenImpl = await MultiTokenVault.new({ from: issuer });
    await this.Vault.upgradeTo(multiTokenImpl.address, { from: issuer });
    this.Vault = await MultiTokenVault.at(this.VaultAddress);
    this.vaultImpl = multiTokenImpl.address;
    this.postconditions.impl = await this.Vault.implementation();
  });

  it('should upgrade to multi-token implementation', function() {
    expect(this.postconditions.issuer).to.be.equal(issuer);
    expect(this.postconditions.impl).to.be.equal(this.vaultImpl);
  });
}

function shouldReturnMultiTokenPaidOut(beneficiary, expectedAmount) {
  beforeEach(async function () {
    this.paidOut = await this.Vault.multiTokensPaidOut(this.TestToken2.address, beneficiary);
  });
  it('should return the expected amount', function () {
    expect(expectedAmount).bignumber.to.be.equal(this.paidOut);
  });
}

function shouldReturnMultiTokenTotalPaidOut(expectedAmount) {
  beforeEach(async function () {
    this.totalPaidOut = await this.Vault.multiTokensTotalPaidOut(this.TestToken2.address);
  });
  it('should return the expected amount', function () {
    expect(expectedAmount).bignumber.to.be.equal(this.totalPaidOut);
  });
}

function multiTokenCashChequeInternal(beneficiary, recipient, cumulativePayout, callerPayout, from) {
  beforeEach(async function () {
    let requestPayout = cumulativePayout.sub(this.preconditions.paidOut);
    //if the requested payout is less than the vaultBalance
    if (requestPayout.lt(this.preconditions.vaultBalance)) {
      // full amount requested can be paid out
      this.totalPayout = requestPayout;
    } else {
      // partial amount requested can be paid out
      this.totalPayout = this.preconditions.vaultBalance;
    }
    this.totalPaidOut = this.preconditions.totalPaidOut + this.totalPayout;
  });

  it('should update paidOut', async function () {
    expect(this.postconditions.paidOut).bignumber.to.be.equal(this.preconditions.paidOut.add(this.totalPayout));
  });

  it('should update totalPaidOut', async function () {
    expect(this.postconditions.totalPaidOut).bignumber.to.be.equal(this.preconditions.paidOut.add(this.totalPayout));
  });

  it('should transfer the correct amount to the recipient', async function () {
    expect(this.postconditions.recipientBalance).bignumber.to.be.equal(this.preconditions.recipientBalance.add(this.totalPayout.sub(callerPayout)))
  });
  it('should transfer the correct amount to the caller', async function () {
    let expectedAmountCaller;
    if (recipient === from) {
      expectedAmountCaller = this.totalPayout;
    } else {
      expectedAmountCaller = callerPayout;
    }
    expect(this.postconditions.callerBalance).bignumber.to.be.equal(this.preconditions.callerBalance.add(expectedAmountCaller));
  });

  it('should emit a ChequeCashed event', function () {
    expectEvent.inLogs(this.logs, "MultiTokenChequeCashed", {
      token: this.TestToken2.address,
      beneficiary,
      recipient: recipient,
      caller: from,
      totalPayout: this.totalPayout,
      cumulativePayout,
      callerPayout,
    });
  });
  it('should only emit a chequeBounced event when insufficient funds', function () {
    if (this.totalPayout.lt(cumulativePayout.sub(this.preconditions.paidOut))) {
      expectEvent.inLogs(this.logs, "MultiTokenChequeBounced", {token: this.TestToken2.address});
    } else {
      const events = this.logs.filter(e => e.event === 'MultiTokenChequeBounced');
      expect(events.length > 0).to.equal(false, `There is a ChequeBounced event`);
    }
  });

  it('should only set the bounced field when insufficient funds', function () {
    if (this.totalPayout.lt(cumulativePayout.sub(this.preconditions.paidOut))) {
      expect(this.postconditions.bounced).to.be.true;
    } else {
      expect(this.postconditions.bounced).to.be.false;
    }
  });
}

function shouldMultiTokenCashChequeBeneficiary(recipient, cumulativePayout, signee, from) {
  beforeEach(async function () {
    this.preconditions = {
      callerBalance: await this.TestToken2.balanceOf(from),
      recipientBalance: await this.TestToken2.balanceOf(recipient),
      vaultBalance: await this.Vault.totalbalanceOf(this.TestToken2.address),
      paidOut: await this.Vault.multiTokensPaidOut(this.TestToken2.address, from),
      totalPaidOut: await this.Vault.multiTokensTotalPaidOut(this.TestToken2.address)
    };

    const issuerSig = await signMultiTokenCheque(this.TestToken2.address, this.Vault, from, cumulativePayout, signee);

    const { logs, receipt } = await this.Vault.multiTokenCashChequeBeneficiary(this.TestToken2.address, recipient, cumulativePayout, issuerSig, { from: from });
    this.logs = logs;
    this.receipt = receipt;

    this.postconditions = {
      callerBalance: await this.TestToken2.balanceOf(from),
      recipientBalance: await this.TestToken2.balanceOf(recipient),
      vaultBalance: await this.Vault.totalbalanceOf(this.TestToken2.address),
      paidOut: await this.Vault.multiTokensPaidOut(this.TestToken2.address, from),
      totalPaidOut: await this.Vault.multiTokensTotalPaidOut(this.TestToken2.address),
      bounced: await this.Vault.multiTokensBounced(this.TestToken2.address)
    };
  });
  multiTokenCashChequeInternal(from, recipient, cumulativePayout, new BN(0), from);
}

function shouldNotMultiTokenCashChequeBeneficiary(recipient, toSubmitCumulativePayout, toSignCumulativePayout, signee, from, value, revertMessage) {
  beforeEach(async function () {
    this.issuerSig = await signMultiTokenCheque(this.TestToken2.address, this.Vault, from, toSignCumulativePayout, signee);
  });
  it('reverts', async function () {
    await expectRevert(this.Vault.multiTokenCashChequeBeneficiary(
      this.TestToken2.address,
      recipient,
      toSubmitCumulativePayout,
      this.issuerSig,
      { from: from, value: value }),
      revertMessage
    );
  });
}

function shouldMultiTokenWithdraw(amount, from) {
  beforeEach(async function () {
    this.preconditions = {
      callerBalance: await this.TestToken2.balanceOf(from),
      totalBalance: await this.Vault.totalbalanceOf(this.TestToken2.address)
    };

    await this.Vault.multiTokenWithdraw(this.TestToken2.address, amount, { from: from });

    this.postconditions = {
      callerBalance: await this.TestToken2.balanceOf(from),
      totalBalance: await this.Vault.totalbalanceOf(this.TestToken2.address)
    };
  });

  it('should have updated the totalBalance', function () {
    expect(this.postconditions.totalBalance).bignumber.to.be.equal(this.preconditions.totalBalance.sub(amount));
  });

  it('should have updated the callerBalance', function () {
    expect(this.postconditions.callerBalance).bignumber.to.be.equal(this.preconditions.callerBalance.add(amount));
  });
}
function shouldNotMultiTokenWithdraw(amount, from, value, revertMessage) {
  it('reverts', async function () {
    await expectRevert(this.Vault.multiTokenWithdraw(
      this.TestToken2.address,
      amount,
      { from: from, value: value }),
      revertMessage
    );
  });
}

function shouldMultiTokenDeposit(amount, from) {
  beforeEach(async function () {
    this.preconditions = {
      balance: await this.Vault.totalbalanceOf(this.TestToken2.address),
    };
    const { logs } = await this.TestToken2.transfer(this.Vault.address, amount, { from: from });
    this.logs = logs;
  });
  it('should update the balance of the vault', async function () {
    expect(await this.Vault.totalbalanceOf(this.TestToken2.address)).bignumber.to.equal(this.preconditions.balance.add(amount));
  });
}

module.exports = {
  shouldUpgradeFromVault,
  shouldReturnMultiTokenPaidOut,
  shouldReturnMultiTokenTotalPaidOut,
  shouldMultiTokenCashChequeBeneficiary,
  shouldNotMultiTokenCashChequeBeneficiary,
  shouldMultiTokenWithdraw,
  shouldNotMultiTokenWithdraw,
  shouldMultiTokenDeposit
};

