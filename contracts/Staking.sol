// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


/*
 * contract Staking
*/
contract Staking is Ownable{
  using SafeMath for uint256;


  event IncreaseStake(address indexed caller, uint256 amount);
  event DecreaseStake(address indexed caller, uint256 amount);
  event UnStake(address indexed caller, uint256 amount);
  event SetLockTime(uint256 indexed lockdays);

  /* structure to keep track of the stake records*/
  struct Stake {
    uint256 amount; /* total stake */
    uint256 canBeDecreasedAt; /* point in time after which stake can be decreased*/
  }

  /* The token against which this Vault writes cheques */
  ERC20 public token;
  uint256 public totalStake;
  // the time to decreaseStake
  uint256 public lockDays;
  /* all stake info */
  mapping(address => Stake) _stakes;

  /**
  @param _token the token this contract uses
  */
  constructor(address _token) {
    token = ERC20(_token);
    // default lock 3 days
    lockDays = 3;
  }

  function setLockTime(uint256 _newlockDays) external onlyOwner() {
    lockDays = _newlockDays;
    emit SetLockTime(lockDays);
  }

  /**
  @notice increase the stake
  @param amount increased stake amount
  */
  function stake(uint amount) external {
    /* increase totalStake*/
    require(token.transferFrom(msg.sender, address(this), amount), "increaseStake: transfer failed");
    _stakes[msg.sender].amount = _stakes[msg.sender].amount.add(amount);
    
    //fresh the lock time
    _stakes[msg.sender].canBeDecreasedAt = block.timestamp + (lockDays * 1 days);

    // increase totalStake
    totalStake = totalStake.add(amount);

    emit IncreaseStake(msg.sender, amount);
  }

  /**
  @notice decrease the stake 
  @param amount decreased stake amount
  */
  function decreaseStake(uint amount) external {
    require(_stakes[msg.sender].amount >= amount, "decreaseStake: unstake exceeds totalstake ");
    /* must reach lock-up time*/
    require(block.timestamp >= _stakes[msg.sender].canBeDecreasedAt, "lock-up time not yet been reached");

    require(token.transfer(msg.sender, amount), "decreaseStake: transfer failed");

    _stakes[msg.sender].amount = _stakes[msg.sender].amount.sub(amount);
    
    /* update totalStake */
    totalStake = totalStake.sub(amount);
    
    emit DecreaseStake(msg.sender, amount);
  }

  /**
  @notice unstake all token
  */
  function unStake() external {
    uint256 amount = _stakes[msg.sender].amount;
    require(amount > 0, "unStake: unstake exceeds totalstake ");
    /* must reach lock-up time*/
    require(block.timestamp >= _stakes[msg.sender].canBeDecreasedAt, "lock-up time not yet been reached");

    require(token.transfer(msg.sender, amount), "unStake: transfer failed");
    
    /* update totalStake */
    totalStake = totalStake.sub(amount);

    _stakes[msg.sender].amount = 0;

    emit UnStake(msg.sender, amount);
  }
  
  /* get total stake amount */
  function selfStakeInfo() external view returns(uint256) {
    return _stakes[msg.sender].amount;
  }

  /* get lock-up time */
  function selfTimeCanBeDecreased() external view returns(uint256) {
    return _stakes[msg.sender].canBeDecreasedAt;
  }

  function getStakeInfo(address addr) external view onlyOwner() returns(uint256) {
    return _stakes[addr].amount;
  }
}