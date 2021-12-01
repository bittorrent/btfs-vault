const {
  BN
} = require("@openzeppelin/test-helpers");

const {
  shouldReturnPaidOut,
  shouldReturnTotalPaidOut,
  shouldReturnIssuer,
  shouldCashChequeBeneficiary,
  shouldNotCashChequeBeneficiary,
  /*
  shouldCashCheque,
  shouldNotCashCheque,
  */
  shouldWithdraw,
  shouldNotWithdraw,
  shouldDeposit,
} = require('./ChequeBook.should.js')

// switch to false if you don't want to test the particular function
enabledTests = {
  cheques: true,
  issuer: true,
  cashChequeBeneficiary: true,
  /*
  cashCheque: false,
  */
  withdraw: true,
  deposit: true
}

// constants to make the test-log more readable
const describeFunction = 'FUNCTION: '
const describePreCondition = 'PRE-CONDITION: '
const describeTest = 'TEST: '

// @param balance total ether deposited in checkbook
// @param issuer the issuer of the checkbook
// @param alice a counterparty of the checkbook 
// @param bob a counterparty of the checkbook
function shouldBehaveLikeChequeBook([issuer, alice, bob, carol]) {
  // defaults used throught the tests
  const defaults = {
    beneficiary: bob,
    recipient: carol,
    firstCumulativePayout: new BN(500),
    secondCumulativePayout: new BN(1000),
    deposit: new BN(10000),
  }

  context('as a cheque book', function () {
    describe(describeFunction + 'paidOutCheques', function () {
      if (enabledTests.cheques) {
        const beneficiary = defaults.beneficiary
        context('when no cheque was ever cashed', function () {
          describe(describeTest + 'shouldReturnPaidOut', function () {
            const expectedAmount = new BN(0)
            shouldReturnPaidOut(beneficiary, expectedAmount)
            shouldReturnTotalPaidOut(expectedAmount)
          })
        })
        context('when a cheque was cashed', function () {
          describe(describePreCondition + 'shouldDeposit', function () {
            shouldDeposit(defaults.deposit, issuer)
            describe(describePreCondition + 'shouldCashChequeBeneficiary', function () {
              shouldCashChequeBeneficiary(defaults.recipient, defaults.firstCumulativePayout, issuer, defaults.beneficiary)
              describe(describeTest + 'shouldReturnPaidOut', function () {
                const expectedAmount = defaults.firstCumulativePayout
                shouldReturnPaidOut(beneficiary, expectedAmount)
                shouldReturnTotalPaidOut(expectedAmount)
              })
            })
          })
        })
      }
    })

    describe(describeFunction + 'issuer', function () {
      if (enabledTests.issuer) {
        shouldReturnIssuer(issuer)
      }
    })
/*
    describe(describeFunction + 'cashCheque', function () {
      if (enabledTests.cashCheque) {
        const beneficiary = defaults.beneficiary
        const firstCumulativePayout = defaults.firstCumulativePayout
        const recipient = defaults.recipient
        context('when the sender is not the issuer', function() {
          const caller = alice
          context("when we don't send value along", function () {
            const value = new BN(0)
            context('when the beneficiary provides the beneficiarySig', function () {
              const beneficiarySignee = beneficiary
              context('when the issuer provides the issuerSig', function () {
                const issuerSignee = issuer
                context('when the callerPayout is non-zero', function () {
                  const callerPayout = defaults.firstCumulativePayout.div(new BN(100))
                  context('when there is some money deposited', function () {
                    context('when the money fully covers the cheque', function() {
                      const depositAmount = firstCumulativePayout.add(defaults.secondCumulativePayout)
                      describe(describePreCondition + 'shouldDeposit', function () {
                        shouldDeposit(depositAmount, issuer)
                        context('when we submit one cheque', function() {
                          describe(describeTest + 'shouldCashCheque', function() {
                            shouldCashCheque(beneficiary, recipient, firstCumulativePayout, callerPayout, caller, beneficiarySignee, issuerSignee)
                          })
                        })
                        context('when we attempt to submit two cheques', function() {
                          describe(describePreCondition + 'shouldCashCheque', function() {
                            shouldCashCheque(beneficiary, recipient, firstCumulativePayout, callerPayout, caller, beneficiarySignee, issuerSignee)
                            context('when the second cumulativePayout is higher than the first cumulativePayout', function() {
                              const secondCumulativePayout = defaults.secondCumulativePayout
                              describe(describeTest + 'shouldCashCheque', function() {
                                shouldCashCheque(beneficiary, recipient, secondCumulativePayout, callerPayout, caller, beneficiarySignee, issuerSignee)
                              })
                            })
                            context('when the second cumulativePayout is lower than the first cumulativePayout', function() {
                              const secondCumulativePayout = firstCumulativePayout.sub(new BN(1))
                              const revertMessage = 'ChequeBook: cannot cash'
                              const beneficiaryToSign = {
                                cumulativePayout: secondCumulativePayout,
                                recipient,
                                callerPayout
                              }
                              const issuerToSign = {
                                beneficiary,
                                cumulativePayout: secondCumulativePayout,
                              }
                              const toSubmit = Object.assign({}, beneficiaryToSign, issuerToSign)
                              describe(describeTest + 'shouldNotCashCheque', function() {
                                shouldNotCashCheque(beneficiaryToSign, issuerToSign, toSubmit, value, caller, beneficiarySignee, issuerSignee, revertMessage)
                              })
                            })
                          })
                        })
                      })
                    })
                    context('when the money partly covers the cheque', function() {
                      const depositAmount = firstCumulativePayout.div(new BN(2))
                      describe(describePreCondition + 'shouldDeposit', function () {
                        shouldDeposit(depositAmount, issuer)
                        describe(describeTest + 'shouldCashCheque', function() {
                          shouldCashCheque(beneficiary, recipient, firstCumulativePayout, callerPayout, caller, beneficiarySignee, issuerSignee)
                        })
                      })
                    })                  
                  })
                  context('when no money is deposited', function () {
                    const revertMessage = 'cannot pay caller'
                    const beneficiaryToSign = {
                      cumulativePayout: firstCumulativePayout,
                      recipient,
                      callerPayout
                    }
                    const issuerToSign = {
                      beneficiary,
                      cumulativePayout: firstCumulativePayout,
                    }
                    const toSubmit = Object.assign({}, beneficiaryToSign, issuerToSign)
                    describe(describeTest + 'shouldNotCashCheque', function() {
                      shouldNotCashCheque(beneficiaryToSign, issuerToSign, toSubmit, value, caller, beneficiarySignee, issuerSignee, revertMessage)
                    })
                  })
                })
                context('when the callerPayout is zero', function () {
                  const callerPayout = new BN(0)
                  describe(describeTest + 'shouldCashCheque', function() {
                    shouldCashCheque(beneficiary, recipient, firstCumulativePayout, callerPayout, caller, beneficiarySignee, issuerSignee)
                  })
                })
              })
              context('when the issuer does not provide the issuerSig', function () {
                const issuerSignee = alice
                const callerPayout = defaults.firstCumulativePayout.div(new BN(100))
                const revertMessage = 'invalid issuer signature'
                const beneficiaryToSign = {
                  cumulativePayout: firstCumulativePayout,
                  recipient,
                  callerPayout
                }
                const issuerToSign = {
                  beneficiary,
                  cumulativePayout: firstCumulativePayout,
                }
                const toSubmit = Object.assign({}, beneficiaryToSign, issuerToSign)
                describe(describeTest + 'shouldNotCashCheque', function() {
                  shouldNotCashCheque(beneficiaryToSign, issuerToSign, toSubmit, value, caller, beneficiarySignee, issuerSignee, revertMessage)
                })
              })
  
            })
            context('when the beneficiary does not provide the beneficiarySig', function () {
              const beneficiarySignee = alice
              const issuerSignee = issuer
              const callerPayout = defaults.firstCumulativePayout.div(new BN(100))
              const revertMessage = 'invalid beneficiary signature'
              const beneficiaryToSign = {
                cumulativePayout: firstCumulativePayout,
                recipient,
                callerPayout
              }
              const issuerToSign = {
                beneficiary,
                cumulativePayout: firstCumulativePayout,
              }
              const toSubmit = Object.assign({}, beneficiaryToSign, issuerToSign)
              describe(describeTest + 'shouldNotCashCheque', function() {
                shouldNotCashCheque(beneficiaryToSign, issuerToSign, toSubmit, value, caller, beneficiarySignee, issuerSignee, revertMessage)
              })
            })
          })
          context('when we send value along', function () {
            const value = new BN(50)
            const beneficiarySignee = alice
            const issuerSignee = issuer
            const callerPayout = defaults.firstCumulativePayout.div(new BN(100))
            const revertMessage = 'revert'
            const beneficiaryToSign = {
              cumulativePayout: firstCumulativePayout,
              recipient,
              callerPayout
            }
            const issuerToSign = {
              beneficiary,
              cumulativePayout: firstCumulativePayout,
            }
            const toSubmit = Object.assign({}, beneficiaryToSign, issuerToSign)
            describe(describeTest + 'shouldNotCashCheque', function() {
              shouldNotCashCheque(beneficiaryToSign, issuerToSign, toSubmit, value, caller, beneficiarySignee, issuerSignee, revertMessage)
            })
          })
        })
        context('when the sender is the issuer', function() {
          const caller = issuer
          const callerPayout = new BN(0)
          const beneficiarySignee = beneficiary
          const issuerSignee = beneficiary // on purpose not the correct signee, as it is not needed
          describe(describeTest + 'shouldCashCheque', function() {
            shouldCashCheque(beneficiary, recipient, firstCumulativePayout, callerPayout, caller, beneficiarySignee, issuerSignee)
          })
        })
      }
    })
    */

    describe(describeFunction + 'cashChequeBeneficiary', function () {
      if (enabledTests.cashChequeBeneficiary) {
        const beneficiary = defaults.beneficiary
        context("when we don't send value along", function () {
          const value = new BN(0)
          context('when the issuer is a signee', function () {
            const sender = beneficiary
            const signee = issuer
            context('when the signee signs the correct fields', function () {
              context('when the recipient is not the beneficiary', function () {
                const recipient = defaults.recipient
                context('when we have not cashed a cheque before', function () {
                  const requestPayout = defaults.firstCumulativePayout
                  context('when there is some balance', function () {
                    context('when the balance is bigger than the requestPayout', function () {
                      describe(describePreCondition + 'shouldDeposit', function () {
                        const depositAmount = requestPayout.add(new BN(50))
                        shouldDeposit(depositAmount, issuer)
                        describe(describeTest + 'shouldCashChequeBeneficiary', function () {
                          shouldCashChequeBeneficiary(recipient, requestPayout, signee, sender)
                        })
                      })
                    })
                    context('when the balance equals the requestPayout', function () {
                      describe(describePreCondition + 'shouldDeposit', function () {
                        const depositAmount = requestPayout
                        shouldDeposit(depositAmount, issuer)
                        describe(describeTest + 'shouldCashChequeBeneficiary', function () {
                          shouldCashChequeBeneficiary(recipient, requestPayout, signee, sender)
                        })
                      })
                    })
                  })
                  context('when there is no balance', function () {
                    describe(describeTest + 'shouldCashChequeBeneficiary', function () {
                      shouldCashChequeBeneficiary(recipient, requestPayout, signee, sender)
                    })
                  })
                })

                context('when we have cashed a cheque before', function () {
                  describe(describePreCondition + 'shouldDeposit', function () {
                    shouldDeposit(defaults.deposit, issuer)
                    describe(describePreCondition + 'shouldCashChequeBeneficiary', function () {
                      shouldCashChequeBeneficiary(recipient, defaults.firstCumulativePayout, signee, sender)
                      describe(describeTest + 'shouldCashChequeBeneficiary', function () {
                        const revertMessage = "ChequeBook: cannot cash"
                        shouldNotCashChequeBeneficiary(recipient, defaults.firstCumulativePayout, defaults.firstCumulativePayout, signee, sender, value, revertMessage)
                      })
                    })
                  })
                })
              })
              context('when the recipient is the beneficiary', function () {
                const recipient = defaults.beneficiary
                const requestPayout = defaults.firstCumulativePayout
                describe(describeTest + 'shouldCashChequeBeneficiary', function () {
                  shouldCashChequeBeneficiary(recipient, requestPayout, signee, sender)
                })
              })
            })
            context('when the signee does not sign the correct fields', function () {
              const revertMessage = "invalid issuer signature"
              const recipient = defaults.recipient
              const toSubmitCumulativePayment = defaults.firstCumulativePayout
              const toSignCumulativePayment = new BN(1)
              const sender = beneficiary
              shouldNotCashChequeBeneficiary(recipient, toSubmitCumulativePayment, toSignCumulativePayment, signee, sender, value, revertMessage)
            })
          })
          context('when the issuer is not a signee', function () {
            const revertMessage = "invalid issuer signature"
            const signee = alice
            const recipient = defaults.recipient
            const toSubmitCumulativePayment = defaults.firstCumulativePayout
            const toSignCumulativePayment = toSubmitCumulativePayment
            const sender = beneficiary
            shouldNotCashChequeBeneficiary(recipient, toSubmitCumulativePayment, toSignCumulativePayment, signee, sender, value, revertMessage)
          })
        })
        context('when we send value along', function () {
          const value = new BN(1)
          const revertMessage = "revert"
          const signee = alice
          const recipient = defaults.recipient
          const toSubmitCumulativePayment = defaults.firstCumulativePayout
          const toSignCumulativePayment = toSubmitCumulativePayment
          const sender = beneficiary
          describe(describeTest + 'shouldNotCashChequeBeneficiary', function () {
            shouldNotCashChequeBeneficiary(recipient, toSubmitCumulativePayment, toSignCumulativePayment, signee, sender, value, revertMessage)
          })
        })
        context('when the sender is not the issuer', function() {
          const value = new BN(0)
          const revertMessage = "invalid issuer signature"
          const signee = beneficiary
          const recipient = defaults.recipient
          const toSubmitCumulativePayment = defaults.firstCumulativePayout
          const toSignCumulativePayment = toSubmitCumulativePayment
          const sender = alice
          describe(describeTest + 'shouldNotCashChequeBeneficiary', function () {
            shouldNotCashChequeBeneficiary(recipient, toSubmitCumulativePayment, toSignCumulativePayment, signee, sender, value, revertMessage)
          })
        })
      }
    })

    describe(describeFunction + 'withdraw', function () {
      if (enabledTests.withdraw) {
        const withdrawAmount = new BN(50)
        context("when we don't send value along", function () {
          const value = new BN(0)
          context('when the sender is the issuer', function () {
            const sender = issuer
            context('when the totalbalance is more than the withdrawAmount', function () {
              const depositAmount = withdrawAmount.mul(new BN(2))
              describe(describePreCondition + 'shouldDeposit', function () {
                shouldDeposit(depositAmount, issuer)
                describe(describeTest + 'shouldWithdraw', function () {
                  shouldWithdraw(withdrawAmount, sender)
                })
              })
            })
            context('when the totalbalance equals the withdrawAount', function () {
              const depositAmount = withdrawAmount
              describe(describePreCondition + 'shouldDeposit', function () {
                shouldDeposit(depositAmount, issuer)
                describe(describeTest + 'shouldWithdraw', function () {
                  shouldWithdraw(withdrawAmount, sender)
                })
              })
            })
            context('when the totalbalance is less than the withdrawAmount', function () {
              const revertMessage = "totalbalance not sufficient"
              shouldNotWithdraw(withdrawAmount, sender, value, revertMessage)
            })
          })
          context('when the sender is not the issuer', function () {
            const sender = alice
            const revertMessage = "not issuer"
            shouldNotWithdraw(withdrawAmount, sender, value, revertMessage)
          })
        })
        context('when we send value along', function () {
          const value = new BN(1)
          const sender = alice
          const revertMessage = "revert"
          shouldNotWithdraw(withdrawAmount, sender, value, revertMessage)
        })
      }
    })

    describe(describeFunction + 'deposit', function () {
      if (enabledTests.deposit) {
        context('when the depositAmount is not zero', function () {
          const depositAmount = new BN(1)
          describe(describeTest + 'shouldDeposit', function () {
            shouldDeposit(depositAmount, issuer)
          })
        })
      }
    })
  })
}

module.exports = {
  shouldBehaveLikeChequeBook
};