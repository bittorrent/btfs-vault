const {
  BN
} = require("@openzeppelin/test-helpers");

const { shouldBehaveLikeVault } = require('./Vault.behavior')
const { shouldDeploy } = require('./Vault.should')

contract('Vault', function([issuer, alice, bob, agent]) {
  describe("when we don't deposit while deploying", async function() {
    this.timeout(100000);
    const value = new BN(0)
    shouldDeploy(issuer, value)
    shouldBehaveLikeVault([issuer, alice, bob, agent], new BN(86400))
  })

  describe('when we deposit while deploying', function() {
    this.timeout(100000);
    const value = new BN(50)
    shouldDeploy(issuer, value)
  })
})