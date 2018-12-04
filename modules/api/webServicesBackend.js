/**
 * Web Services Backend
 * @author Ty Everett <ty@tyweb.us>
 * @file Starts the backend web services
 */

const express = require('express')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const bodyParser = require('body-parser')
require('dotenv').config()
/*

TODO require each module to explicitly use MySQL and establish
its own database connections on every request. This will remove
mysql as a requirement in this file, because it will be required
by the modules themselves.

*/
const mysql = require('mysql')

// include all endpoint modules
const registerEndpoint = require('./register.js')
const identifyEndpoint = require('./identify.js')
const loginEndpoint = require('./login.js')
const loggedInEndpoint = require('./loggedin.js')
const getPaymentsEndpoint = require('./getpayments.js')
const getUnpaidPaymentsEndpoint = require('./getunpaidpayments.js')
const setUsernameEndpoint = require('./setusername.js')
const getUsernameEndpoint = require('./getusername.js')
const getMerchantIDEndpoint = require('./getmerchantid.js')
const paymentSentEndpoint = require('./paymentsent.js')
const payEndpoint = require('./pay.js')

// include all service daemons
const fundsTransferDaemon = require('./fundsTransfer.js')
const brokenPaymentsDaemon = require('./brokenPayments.js')

// print startup message
console.log('Starting Web Services Backend...')

// create the express instance
const app = express()

// se up bodyParser tor form data handling
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// set up persistant session
app.use(
  session({
    name: 'gateway-session',
    secret: process.env.WEB_SESSION_SECRET,
    saveUninitialized: true,
    resave: true,
    store: new FileStore(),
  }),
)

// enable CORS to allow for API calls from other sites
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept',
  )
  next()
})

// serve the public directory's static resources
// (API docs landing page)
app.use(express.static('public'))

// listen for connections
app.listen(process.env.WEB_PORT, () => {
  console.log('Web services API listening on port', process.env.WEB_PORT)
})

// log into the database
// TODO: do this inside of the request handler for each module that
// requires it. This will allow better database access permission
// regulations in the future.
var conn = mysql.createConnection({
  host: process.env.SQL_DATABASE_HOST,
  user: process.env.SQL_DATABASE_USER,
  password: process.env.SQL_DATABASE_PASSWORD,
  database: process.env.SQL_DATABASE_DB_NAME,
})

// start the database connection
conn.connect((err) => {
  if (err) {
    throw err
  }
  console.log('Database connection established')
})

// start the payment processing daemons
// assign to variables to prevent garbage collection
var ftd = new fundsTransferDaemon()
var bpd = new brokenPaymentsDaemon()

// finally, utilize API endpoints for appropriate requests
app.post('/register', registerEndpoint)
app.get('/identify', identifyEndpoint)
app.get('/login', loginEndpoint)
app.get('/loggedin', loggedInEndpoint)
app.get('/getpayments', getPaymentsEndpoint)
app.get('/getunpaidpayments', getUnpaidPaymentsEndpoint)
app.post('/setusername', setUsernameEndpoint)
app.get('/getusername', getUsernameEndpoint)
app.get('/getmerchantid', getMerchantIDEndpoint)
app.get('/paymentsent', paymentSentEndpoint)
app.get('/pay', payEndpoint)
