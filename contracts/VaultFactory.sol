// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;
import "./VaultProxy.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/**
@title Factory contract for Vault
@author The Btfs Authors
@notice This contract deploys Vault contracts
*/
contract VaultFactory {

  /**
  @notice event fired after new Vault deployed
  @param issuer the issuer of the new vault contract
  @param contractAddress the address of the new deployed contract
  @param id the peerID of the btfs node
  */
  event VaultDeployed(address issuer,address contractAddress,string id);

  /* mapping to keep track of which contracts were deployed by this factory */
  mapping (address => bool) public deployedContracts;
  /* mapping between btfs node's peerID and its vault address */
  mapping (string => address) public peerVaultAddress;

  /* address of the TRC20-token, to be used by the to-be-deployed vaults */
  address public TokenAddress;
  /* address of the code contract from which all vaults are cloned */
  address public master;

  constructor(address _TokenAddress) {
    TokenAddress = _TokenAddress;
    VaultProxy _master = new VaultProxy();
    // set the issuer of the master contract to prevent misuse
    //_master.init(address(1), address(0));
    master = address(_master);
  }
  /**
  @notice creates a clone of the master Vault contract
  @param issuer the issuer of cheques for the new vault
  @param _logic the logic vault addr
  @param salt salt to include in create2 to enable the same address to deploy multiple Vaults
  @param id the peerID of the btfs node
  @param _data the calldata to run when deploy vault proxy
  */
  function deployVault(address issuer, address _logic, bytes32 salt, string memory id, bytes memory _data)
  public returns (address) {
    address payable contractAddress = payable(Clones.cloneDeterministic(master, keccak256(abi.encode(msg.sender, salt))));
    VaultProxy(contractAddress).init(_logic, _data);
    deployedContracts[contractAddress] = true;
    peerVaultAddress[id] = contractAddress;
    emit VaultDeployed(issuer,contractAddress,id);
    return contractAddress;
  }
}
