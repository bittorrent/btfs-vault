const abi = require('ethereumjs-abi')

/*
Note:switch chainId to fix the right chain
the chainId is set to 31337 which is the hardhat default
*/
const ChainId = 31337

const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' }
]

const ChequeType = [
  { name: 'vault', type: 'address' },
  { name: 'beneficiary', type: 'address' },
  { name: 'cumulativePayout', type: 'uint256' }
]

async function sign(hash, signer) {
  let signature = await web3.eth.sign(hash, signer)

  let rs = signature.substr(0,130);  
  let v = parseInt(signature.substr(130, 2), 16) + 27

  return rs + v.toString(16)
}

function signTypedData(eip712data, signee) {
  return new Promise((resolve, reject) => 
    web3.currentProvider.send({
      method: 'eth_signTypedData_v4',
      params: [signee, eip712data]
    },
    (err, result) => err == null ? resolve(result.result) : reject(err))
  )
}

async function signCheque(vault, beneficiary, cumulativePayout, signee, chainId = ChainId) {
  const cheque = {
    vault: vault.address,
    beneficiary,
    cumulativePayout: cumulativePayout.toNumber()
  }

  const eip712data = {
    types: {
      EIP712Domain,
      Cheque: ChequeType
    },
    domain: {
      name: "Vault",
      version: "1.0",
      chainId
    },
    primaryType: 'Cheque',
    message: cheque
  }

  return signTypedData(eip712data, signee)
}

module.exports = {
  signCheque,
  sign
};