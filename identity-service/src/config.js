const convict = require('convict')
const fs = require('fs')

// Define a schema
const config = convict({
  dbUrl: {
    doc: 'Database URL connection string',
    format: String,
    env: 'dbUrl',
    default: null
  },
  redisHost: {
    doc: 'Redis host name',
    format: String,
    env: 'redisHost',
    default: null
  },
  redisPort: {
    doc: 'Redis port',
    format: 'port',
    env: 'redisPort',
    default: null
  },
  web3Provider: {
    doc: 'web3 provider url',
    format: String,
    env: 'web3Provider',
    default: null
  },
  secondaryWeb3Provider: {
    doc: 'secondary web3 provider url',
    format: String,
    env: 'secondaryWeb3Provider',
    default: null
  },
  port: {
    doc: 'Port to run service on',
    format: 'port',
    env: 'port',
    default: null
  },
  logLevel: {
    doc: 'Log level',
    format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    env: 'logLevel',
    default: 'info'
  },
  twitterAPIKey: {
    doc: 'Twitter API key',
    format: String,
    env: 'twitterAPIKey',
    default: null
  },
  twitterAPISecret: {
    doc: 'Twitter API Secret',
    format: String,
    env: 'twitterAPISecret',
    default: null
  },
  instagramAPIKey: {
    doc: 'Instagram API Key',
    format: String,
    env: 'instagramAPIKey',
    default: null
  },
  instagramAPISecret: {
    doc: 'Instagram API Secret',
    format: String,
    env: 'instagramAPISecret',
    default: null
  },
  relayerPrivateKey: {
    doc: 'Relayer(used to make relay transactions) private key',
    format: String,
    env: 'relayerPrivateKey',
    default: null,
    sensitive: true
  },
  relayerPublicKey: {
    doc: 'Relayer(used to make relay transactions) public key',
    format: String,
    env: 'relayerPublicKey',
    default: null
  },
  userVerifierPrivateKey: {
    doc: 'User verifier(used to write users to chain as isVerified) private key',
    format: String,
    env: 'userVerifierPrivateKey',
    default: null,
    sensitive: true
  },
  userVerifierPublicKey: {
    doc: 'User verifier(used to write users to chain as isVerified) public key',
    format: String,
    env: 'userVerifierPublicKey',
    default: null
  },
  blacklisterPrivateKey: {
    doc: 'Blacklister(used to write multihashes as blacklisted on chain) private key',
    format: String,
    env: 'blacklisterPrivateKey',
    default: null,
    sensitive: true
  },
  blacklisterPublicKey: {
    doc: 'Blacklister(used to write multihashes as blacklisted on chain) public key',
    format: String,
    env: 'blacklisterPublicKey',
    default: null
  },
  rateLimitingReqLimit: {
    doc: 'Total request per hour rate limit',
    format: 'nat',
    env: 'rateLimitingReqLimit',
    default: null
  },
  rateLimitingAuthLimit: {
    doc: 'Auth requests per hour rate limit',
    format: 'nat',
    env: 'rateLimitingAuthLimit',
    default: null
  },
  rateLimitingTwitterLimit: {
    doc: 'Twitter requests per hour rate limit',
    format: 'nat',
    env: 'rateLimitingTwitterLimit',
    default: null
  },
  rateLimitingListensPerTrackPerHour: {
    doc: 'Listens per track per user per Hour',
    format: 'nat',
    env: 'rateLimitingListensPerTrackPerHour',
    default: null
  },
  rateLimitingListensPerIPPerHour: {
    doc: 'Listens per track per IP per Hour',
    format: 'nat',
    env: 'rateLimitingListensPerIPPerHour',
    default: null
  },
  rateLimitingListensPerTrackPerDay: {
    doc: 'Listens per track per user per Day',
    format: 'nat',
    env: 'rateLimitingListensPerTrackPerDay',
    default: null
  },
  rateLimitingListensPerIPPerDay: {
    doc: 'Listens per track per IP per Day',
    format: 'nat',
    env: 'rateLimitingListensPerIPPerDay',
    default: null
  },
  rateLimitingListensPerTrackPerWeek: {
    doc: 'Listens per track per user per Week',
    format: 'nat',
    env: 'rateLimitingListensPerTrackPerWeek',
    default: null
  },
  rateLimitingListensPerIPPerWeek: {
    doc: 'Listens per track per IP per Week',
    format: 'nat',
    env: 'rateLimitingListensPerIPPerWeek',
    default: null
  },
  minimumBalance: {
    doc: 'Minimum token balance below which /balance_check fails',
    format: Number,
    env: 'minimumBalance',
    default: null
  },
  mailgunApiKey: {
    doc: 'Mailgun API key used to send emails',
    format: String,
    env: 'mailgunApiKey',
    default: ''
  },
  // loaded through contract-config.json, if an env variable declared, env var takes precendence
  registryAddress: {
    doc: 'Registry address of contracts deployed on web3Provider',
    format: String,
    default: null,
    env: 'registryAddress'
  },
  audiusNotificationUrl: {
    doc: 'Url of audius notifications',
    format: String,
    default: null,
    env: 'audiusNotificationUrl'
  },
  notificationStartBlock: {
    doc: 'First block to start notification indexing from',
    format: Number,
    default: 0,
    env: 'notificationStartBlock'
  },
  notificationDiscoveryProvider: {
    doc: 'Whitelisted discovery provider to query notifications',
    format: String,
    default: 'http://localhost:5000',
    env: 'notificationDiscoveryProvider'
  },
  ethTokenAddress: {
    doc: 'ethTokenAddress',
    format: String,
    default: null,
    env: 'ethTokenAddress'
  },
  ethRegistryAddress: {
    doc: 'ethRegistryAddress',
    format: String,
    default: null,
    env: 'ethRegistryAddress'
  },
  ethProviderUrl: {
    doc: 'ethProviderUrl',
    format: String,
    default: null,
    env: 'ethProviderUrl'
  },
  ethOwnerWallet: {
    doc: 'ethOwnerWallet',
    format: String,
    default: null,
    env: 'ethOwnerWallet'
  },
  isTestRun: {
    doc: 'Sets some configs and excludes some processes if this is a test run',
    format: Boolean,
    default: false,
    env: 'isTestRun'
  },
  awsAccessKeyId: {
    doc: 'AWS access key with SNS permissions',
    format: String,
    default: null,
    env: 'awsAccessKeyId'
  },
  awsSecretAccessKey: {
    doc: 'AWS access key secret with SNS permissions',
    format: String,
    default: null,
    env: 'awsSecretAccessKey'
  },
  awsSNSiOSARN: {
    doc: 'AWS ARN for iOS in SNS',
    format: String,
    default: null,
    env: 'awsSNSiOSARN'
  },
  awsSNSAndroidARN: {
    doc: 'AWS ARN for Android in SNS',
    format: String,
    default: null,
    env: 'awsSNSAndroidARN'
  },
  minGasPrice: {
    doc: 'minimum gas price; 10 GWei, 10 * POA default gas price',
    format: 'nat',
    default: 10 * Math.pow(10, 9),
    env: 'minGasPrice'
  },
  highGasPrice: {
    doc: 'max gas price; 25 GWei, 2.5 * minGasPrice',
    format: 'nat',
    default: 25 * Math.pow(10, 9),
    env: 'highGasPrice'
  },
  // ganache gas price is extremely high, so we hardcode a lower value (0x09184e72a0 from docs here)
  ganacheGasPrice: {
    doc: 'ganache gas price',
    format: 'nat',
    default: 39062500000,
    env: 'ganacheGasPrice'
  },
  // 1011968 is used by default; 0xf7100 in hex
  defaultGasLimit: {
    doc: 'default gas limit',
    format: String,
    default: '0xf7100',
    env: 'defaultGasLimit'
  },
  browserPushGCMAPIKey: {
    doc: 'Google Cloud Messaging Browser Push Key',
    format: String,
    default: '',
    env: 'browserPushGCMAPIKey'
  },
  browserPushVapidPublicKey: {
    doc: 'Vapid Public Key for browser push notification',
    format: String,
    default: '',
    env: 'browserPushVapidPublicKey'
  },
  browserPushVapidPrivateKey: {
    doc: 'Vapid Private Key for browser push notifications',
    format: String,
    default: '',
    env: 'browserPushVapidPrivateKey'
  },
  apnKeyId: {
    doc: 'APN Key ID for safari browser push notifications',
    format: String,
    default: '',
    env: 'apnKeyId'
  },
  apnTeamId: {
    doc: 'APN Team ID for safari browser push notifications',
    format: String,
    default: '',
    env: 'apnTeamId'
  },
  apnAuthKey: {
    doc: 'APN Auth Key, read from a string into a file',
    format: String,
    default: '',
    env: 'apnAuthKey'
  },
  environment: {
    doc: 'Determines running on development, staging, or production',
    format: String,
    default: 'development',
    env: 'environment'
  }
})

// if you wanted to load a file
// this is lower precendence than env variables, so if registryAddress or ownerWallet env
// variables are defined, they take precendence

// TODO(DM) - remove these defaults
const defaultConfigExists = fs.existsSync('default-config.json')
if (defaultConfigExists) config.loadFile('default-config.json')

if (fs.existsSync('eth-contract-config.json')) {
  let ethContractConfig = require('../eth-contract-config.json')
  config.load({
    'ethTokenAddress': ethContractConfig.audiusTokenAddress,
    'ethRegistryAddress': ethContractConfig.registryAddress,
    'ethOwnerWallet': ethContractConfig.ownerWallet,
    'ethWallets': ethContractConfig.allWallets
  })
}

// the contract-config.json file is used to load registry address locally
// during development
const contractConfigExists = fs.existsSync('contract-config.json')
if (contractConfigExists) config.loadFile('contract-config.json')

// Perform validation and error any properties are not present on schema
config.validate()

module.exports = config
