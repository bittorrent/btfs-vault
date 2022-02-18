require("@nomiclabs/hardhat-truffle5");
require("solidity-coverage")
require("@nomiclabs/hardhat-waffle");
require('@openzeppelin/hardhat-upgrades');


// Define mnemonic for accounts.
let mnemonic = process.env.MNEMONIC;
if (!mnemonic) {
  // NOTE: this fallback is for development only!
  // When using other networks, set the secret in .env.
  // DO NOT commit or share your mnemonic with others!
  mnemonic = 'test test test test test test test test test test test test';
}

const accounts = { mnemonic };

/*
   these pks are test accounts from the network your specified,
   change them when start yarn test...
*/
const pk1 = "0x345d6cedeea99b5c894113472c4490acdd79815f63fbfa80e90689458291be6c";
const pk2 = "0x6482e7694fdf7399eedc7cfc1162a83c11b3c22ce933ee419820527d2bc01236";
const pk3 = "0x9a0e7ea3676a91687909ffc5e680493431a7a2375c8f52382812335e2d272b34";
const pk4 = "0x0a30e3b64caa73c5986befc782a7b20ac3e7938b754676456f7bf4b8c1dab86b";


// Config for hardhat.
module.exports = {
  solidity: { version: '0.8.2',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
    }
  },
  networks: {
    hardhat: {
      accounts,
    },
    local: {
      url: 'http://127.0.0.1:8545',
      accounts: [pk1, pk2, pk3, pk4],
    },

    bttc: {
      url: 'https://test-rpc.bittorrentchain.io/',
      accounts: [pk1, pk2, pk3, pk4],
      gas: 8500000,
      gasPrice: 300000000000000,
      timeoutBlocks: 200,
    },


    staging: {
      url: 'https://goerli.infura.io/v3/' + process.env.INFURA_TOKEN,
      accounts,
    },
  },
  paths: {
    sources: 'contracts',
  },
};
