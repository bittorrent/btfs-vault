const {
  BN
} = require("@openzeppelin/test-helpers");

const { shouldBehaveLikeVault, shouldBehaveProxable, shouldBehaveUpgradeable, shouldBehaveCashable } = require('./Vault.behavior');
const { shouldBehaveLikeMultiTokenVault, shouldBehaveMultiTokenCashable } = require('./MultiTokenVault.behavior');
const { shouldUpgradeFromVault } = require('./MultiTokenVault.should');

contract('MultiTokenVault', function([issuer, alice, bob, agent]) {
  describe("when upgrade the vault implementation, upgrade from vault", async function() {
    this.timeout(100000);
    const value = new BN(0);
    shouldUpgradeFromVault(issuer, value);
    shouldBehaveProxable([issuer, alice]);
    shouldBehaveUpgradeable([issuer, alice]);
  });

  describe("when we don't deposit while deploying, upgrade from vault", async function() {
    this.timeout(100000);
    const value = new BN(0);
    shouldUpgradeFromVault(issuer, value);
    shouldBehaveCashable([issuer, alice, bob, agent]);
    shouldBehaveLikeVault([issuer, alice, bob, agent], new BN(86400));
    shouldBehaveMultiTokenCashable([issuer, alice, bob, agent]);
    shouldBehaveLikeMultiTokenVault([issuer, alice, bob, agent], new BN(86400));
  });

  describe('when we deposit while deploying, upgrade from vault', function() {
    this.timeout(100000);
    const value = new BN(50);
    shouldUpgradeFromVault(issuer, value);
  });

});