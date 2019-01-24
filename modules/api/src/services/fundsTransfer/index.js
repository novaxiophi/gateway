/**
 * Funds transfer daemon
 * @author The Gateway Project Developers <hello@gateway.cash>
 * @file Provides a daemon for transfering funds
 */
import bch from 'bitcore-lib-cash'
import bchaddr from 'bchaddrjs'
import { mysql, getAddressBalance, executeCallback } from 'utils'
import axios from 'axios'

/**
 * Checks if apayment needs to be processed.
 * Calls processPayment or executeCallback if needed.
 * @param payment - The record from the payments table
 */
let checkPayment = async (payment) => {
  console.log(`Checking payment #${payment.tableIndex}...`)
  let balance = await getAddressBalance(payment.paymentAddres)
  if (balance <= 0) return
  if (payment.privateKey) {
    payment.addressBalance = balance
    try {
      await processPayment(payment)
      console.log(`Successfully forwarded payment #${payment.tableIndex}`)
    } catch (e) {
      console.error(`Error with payment #${payment.tableIndex}`)
    }
  } else {
    try {
      await executeCallback(payment)
      await mysql.query(
        'UPDATE payments SET status = ? WHERE tableIndex = ? LIMIT 1',
        ['complete', payment.tableIndex]
      )
      console.log(`XPUB payment #${payment.tableIndex} finished!`)
    } catch (e) {
      console.error(`Error with XPUB payment #${payment.tableIndex}`)
    }
  }
}

let processPayment = async (payment) => {
  // get the merchant ID of the merchant for whom this payment is destined
  let sql = 'select merchantID from payments where paymentAddress = ? limit 1'
  let result = await mysql.query(sql, [payment.address])
  let merchantID = result[0].merchantID

  // get the payout address of the merchant
  sql = 'select payoutAddress from users where merchantID = ? limit 1'
  result = await mysql.query(sql, [merchantID])
  let merchantAddress = result[0].payoutAddress

  // get the full payment information
  sql = `select
    paymentKey,
    callbackURL,
    paymentID,
    paymentTXID
    from payments
    where
    paymentAddress = ?
    limit 1`
  result = await mysql.query(sql, [payment.address])
  result = result[0]
  let {
    paymentKey,
    callbackURL,
    paymentID
  } = result

  // set up some more variables to keep a handle on things
  let paymentAddress = payment.address
  let paymentAddressLegacy = bchaddr.toLegacyAddress(paymentAddress)
  let paymentTXID = payment.txid

  // find all the UTXOs for the payment address
  let paymentUTXOs = await axios.get(
    BLOCK_EXPLORER_BASE + '/addr/' + paymentAddressLegacy + '/utxo'
  )
  paymentUTXOs = paymentUTXOs.data
  console.log('Got', paymentAddressLegacy, paymentUTXOs.length, 'UTXOs')
  if (isNaN(paymentUTXOs.length) || paymentUTXOs.length <= 0) {
    console.error('No UTXOs, aborting.')
    return
  }

  /*
    Create a BCH transaction spending the payment UTXOs to the merchant address
    (and to Gateway if they elect to contribute)
   */
  let transferTransaction = new bch.Transaction()
  let totalTransferred = 0

  // the inputs for this transaction are the UTXOs from the payment address
  for(var i = 0, l = paymentUTXOs.length; i < l; i++) {
    transferTransaction.from({
      'txid': paymentUTXOs[i].txid,
      'vout': paymentUTXOs[i].vout,
      'address': bchaddr.toCashAddress(paymentUTXOs[i].address),
      'scriptPubKey': paymentUTXOs[i].scriptPubKey,
      'amount': paymentUTXOs[i].amount
    })
    totalTransferred += (paymentUTXOs[i].amount * 100000000)
  }

  // round the totalTransferred to be Satoshis
  totalTransferred = totalTransferred.toFixed(0)
  console.log('Added UTXOs, total', ( totalTransferred / 100000000 ), 'BCH')

  // TODO: optional Gateway contributions
  // to bitcoincash:pz3txlyql9vc08px98v69a7700g6aecj5gc0q3xhng
  transferTransaction.to(
    bchaddr.toCashAddress(merchantAddress),
    totalTransferred - 200
  )
  transferTransaction.fee(200)
  transferTransaction.sign(bch.PrivateKey.fromWIF(paymentKey))
  let rawTransferTransaction = transferTransaction.toString()
  console.log('Transfer Transaction:\n\n' + rawTransferTransaction + '\n')

  /*
    Broadcast transaction to multiple places
  */

  // Our current block explorer
  let transferTXID = await axios.post(
    BLOCK_EXPLORER_BASE + '/tx/send',
    {
      rawtx: rawTransferTransaction
    }
  )
  transferTXID = transferTXID.data.txid

  // Bitcoin.com block explorer
  await axios.post(
    'https://api.blockchair.com/bitcoin-cash/push/transaction',
    {
      data: rawTransferTransaction
    }
  )

  // Print the payment information
  console.log('Transfer TXID:\n' + transferTXID + '\n')
  console.log('Payment Address:\n' + paymentAddress + '\n')
  console.log('Payment TXID:\n' + paymentTXID + '\n')
  console.log('Amount Paid: ' + (totalTransferred / 100000000) + ' BCH' + '\n')

  // delete transaction from pending
  sql = 'delete from pending where txid = ?'
  await mysql.query(sql, [payment.txid])

  // update payments with new data
  sql = `update payments
    set paymentTXID = ?,
    paidAmount = ?,
    transferTXID = ?
    where
    paymentAddress = ?
    limit 1`
  await mysql.query(
    sql,
    [payment.txid, totalTransferred, transferTXID, payment.address]
  )

  // increment the total sales of the merchant
  sql = 'update users set totalSales = totalSales + ? where merchantID = ?'
  await mysql.query(sql, [totalTransferred, merchantID])


}


export default async () => {
  let pendingPayments = await mysql.query(
    'SELECT * FROM payments WHERE status = ?',
    ['pending']
  )
  pendingPayments.forEach(async (payment) => {
    await checkPayment(payment)
  })
}
