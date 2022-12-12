// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./Vault.sol";

/**
@title MultiTokenVault contract without waivers
@author The Btfs Authors
@notice The VaultMultiToken contract is a upgrade version of Vault contract to support deposit, withdraw and cash with the other specified token.
*/
contract MultiTokenVault is Vault {
  using SafeMath for uint;

  event MultiTokenChequeCashed(
    address token,
    address indexed beneficiary,
    address indexed recipient,
    address indexed caller,
    uint totalPayout,
    uint cumulativePayout,
    uint callerPayout
  );
  event MultiTokenChequeBounced(address indexed token);
  event MultiTokenVaultWithdraw(address indexed token, address indexed from, uint amount);
  event MultiTokenVaultDeposit(address indexed token, address indexed from, uint amount);

  bytes32 public constant MULTI_TOKEN_CHEQUE_TYPEHASH = keccak256(
    "MultiTokenCheque(address token,address vault,address beneficiary,uint256 cumulativePayout)"
  );

  /* paid out for multi-tokens */
  mapping (address => mapping(address => uint)) public multiTokensPaidOut;
  /* total paid out for multi-tokens */
  mapping (address => uint) public multiTokensTotalPaidOut;
  /* bounced for multi-tokens */
  mapping (address => bool) public multiTokensBounced;


  /// @return the specified token balance of the Vault
  function totalbalanceOf(address _token) public view returns(uint) {
    return ERC20(_token).balanceOf(address(this));
  }


  /**
  @dev internal function responsible for checking the issuerSignature, updating hardDeposit balances and doing transfers with the specified token address.
  Called by  multiTokenCashChequeBeneficary
  @param _token the specified cash token
  @param beneficiary the beneficiary to which cheques were assigned. Beneficiary must be an Externally Owned Account
  @param recipient receives the differences between cumulativePayment and what was already paid-out to the beneficiary minus callerPayout
  @param cumulativePayout cumulative amount of cheques assigned to beneficiary
  @param issuerSig if issuer is not the sender, issuer must have given explicit approval on the cumulativePayout to the beneficiary
  */
  function _multiTokenCashChequeInternal(
    address _token,
    address beneficiary,
    address recipient,
    uint cumulativePayout,
    bytes memory issuerSig
  ) internal {
    if (_token == address(token)) {
      _cashChequeInternal(beneficiary, recipient, cumulativePayout, issuerSig);
      return;
    }

    /* The issuer must have given explicit approval to the cumulativePayout, either by being the caller or by signature*/
    if (msg.sender != issuer) {
      require(issuer == recoverEIP712(multiTokenChequeHash(_token, address(this), beneficiary, cumulativePayout), issuerSig),
        "invalid issuer signature");
    }

    require(cumulativePayout > multiTokensPaidOut[_token][beneficiary], "Vault: cannot cash");
    uint totalPayout = cumulativePayout.sub(multiTokensPaidOut[_token][beneficiary]);
    uint balance = totalbalanceOf(_token);
    /* let the world know that the issuer has over-promised on outstanding cheques */
    if (totalPayout > balance) {
      bounced = true;
      emit MultiTokenChequeBounced(_token);
    }
    require(totalPayout <= balance, "Vault: insufficient fund");

    /* increase the stored paidOut amount to avoid double payout */
    multiTokensPaidOut[_token][beneficiary] = multiTokensPaidOut[_token][beneficiary].add(totalPayout);
    multiTokensTotalPaidOut[_token] = multiTokensTotalPaidOut[_token].add(totalPayout);

    /* do the actual payment */
    require(ERC20(_token).transfer(recipient, totalPayout), "transfer failed");

    emit MultiTokenChequeCashed(_token, beneficiary, recipient, msg.sender, totalPayout, cumulativePayout, 0);
  }

  /**
  @notice cash a cheque as beneficiary with the specified token
  @param _token the specified cash token
  @param recipient receives the differences between cumulativePayment and what was already paid-out to the beneficiary minus callerPayout
  @param cumulativePayout amount requested to pay out
  @param issuerSig issuer must have given explicit approval on the cumulativePayout to the beneficiary
  */
  function multiTokenCashChequeBeneficiary(address _token, address recipient, uint cumulativePayout, bytes memory issuerSig) public {
    _multiTokenCashChequeInternal(_token, msg.sender, recipient, cumulativePayout, issuerSig);
  }

  function multiTokenWithdraw(address _token, uint amount) public {
    if (_token == address(token)) {
      withdraw(amount);
      return;
    }
    /* only issuer can do this */
    require(msg.sender == issuer, "not issuer");
    /* ensure we don't take anything from the hard deposit */
    require(amount <= totalbalanceOf(_token), "totalbalance not sufficient");
    require(ERC20(_token).transfer(issuer, amount), "transfer failed");
    emit MultiTokenVaultWithdraw(_token, issuer, amount);
  }

  /**
  @notice deposit the specified _token to address(this), befrore it, must approve to address(this)
  @param _token the specified deposit token address
  @param amount the deposit amount
  */
  function multiTokenDeposit(address _token, uint amount) public {
    if (_token == address(token)) {
      deposit(amount);
      return;
    }
    require(ERC20(_token).transferFrom(msg.sender, address(this), amount), "deposit failed");
    emit MultiTokenVaultDeposit(_token, msg.sender, amount);
  }

  function multiTokenChequeHash(address _token, address vault, address beneficiary, uint cumulativePayout)
  internal pure returns (bytes32) {
    return keccak256(abi.encode(
        MULTI_TOKEN_CHEQUE_TYPEHASH,
        _token,
        vault,
        beneficiary,
        cumulativePayout
      ));
  }
}