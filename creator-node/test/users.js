const request = require('supertest')
const sigUtil = require('eth-sig-util')

const BlacklistManager = require('../src/blacklistManager')

const { getApp } = require('./lib/app')
const { createStarterCNodeUser, createStarterCNodeUserWithKey, testEthereumConstants } = require('./lib/dataSeeds')
const { getIPFSMock } = require('./lib/ipfsMock')
const { getLibsMock } = require('./lib/libsMock')

describe('test Users', function () {
  let app, server, ipfsMock, libsMock

  beforeEach(async () => {
    ipfsMock = getIPFSMock()
    libsMock = getLibsMock()

    const appInfo = await getApp(ipfsMock, libsMock, BlacklistManager)
    await BlacklistManager.blacklist(ipfsMock)

    app = appInfo.app
    server = appInfo.server
  })

  afterEach(async () => {
    await server.close()
  })

  it('creates new user', function (done) {
    request(app)
      .post('/users')
      .send({ walletAddress: testEthereumConstants.pubKey })
      .expect(200, done)
  })

  it('fails new user create on bad address', function (done) {
    request(app)
      .post('/users')
      .send({ walletAddress: '0x123' })
      .expect(400, done)
  })

  it('user create is idempotent', async function () {
    await createStarterCNodeUser()
    await request(app)
      .post('/users')
      .send({ walletAddress: testEthereumConstants.pubKey })
      .expect(200)
  })

  it('fail to get challenge without wallet address', function (done) {
    request(app)
      .get('/users/login/challenge')
      .expect(400, done)
  })

  it('get challenge with wallet address', async function () {
    await createStarterCNodeUser()
    await request(app)
      .get('/users/login/challenge')
      .query({ walletPublicKey: testEthereumConstants.pubKey })
      .expect(200)
  })

  it('fail using POST challenge route with missing body keys', async function () {
    await request(app)
      .post('/users/login/challenge')
      .send({ })
      .expect(400)
  })

  it('fail using POST challenge route with invalid data and signature', async function () {
    await request(app)
      .post('/users/login/challenge')
      .send({ data: 'data', signature: 'signature' })
      .expect(400)
  })

  it('fail using POST challenge route with no cnode user', async function () {
    let challengeResp
    await request(app)
      .get('/users/login/challenge')
      .query({ walletPublicKey: testEthereumConstants.pubKey })
      .expect(200)
      .then(response => {
        challengeResp = response.body
      })

    const signature = sigUtil.personalSign(Buffer.from(testEthereumConstants.privKeyHex, 'hex'), { data: challengeResp.challenge })

    await request(app)
      .post('/users/login/challenge')
      .send({ data: challengeResp.challenge, signature })
      .expect(400)
  })

  it('fail using POST challenge route with challenge key not present in redis', async function () {
    let challengeResp
    const randomPubKey = '0xadD36bad12002f1097Cdb7eE24085C28e9random'
    await createStarterCNodeUser()
    await createStarterCNodeUserWithKey(randomPubKey)
    await request(app)
      .get('/users/login/challenge')
      .query({ walletPublicKey: randomPubKey })
      .expect(200)
      .then(response => {
        challengeResp = response.body
      })

    const signature = sigUtil.personalSign(Buffer.from(testEthereumConstants.privKeyHex, 'hex'), { data: challengeResp.challenge })

    await request(app)
      .post('/users/login/challenge')
      .send({ data: challengeResp.challenge, signature })
      .expect(400)
  })

  it('fail to log user in with challenge key if used twice', async function () {
    let challengeResp
    await createStarterCNodeUser()
    await request(app)
      .get('/users/login/challenge')
      .query({ walletPublicKey: testEthereumConstants.pubKey })
      .expect(200)
      .then(response => {
        challengeResp = response.body
      })

    const signature = sigUtil.personalSign(Buffer.from(testEthereumConstants.privKeyHex, 'hex'), { data: challengeResp.challenge })

    await request(app)
      .post('/users/login/challenge')
      .send({ data: challengeResp.challenge, signature })
      .expect(200)

    await request(app)
      .post('/users/login/challenge')
      .send({ data: challengeResp.challenge, signature })
      .expect(400)
  })

  it('successfully log user in with challenge key using challenge routes', async function () {
    let challengeResp
    await createStarterCNodeUser()
    await request(app)
      .get('/users/login/challenge')
      .query({ walletPublicKey: testEthereumConstants.pubKey })
      .expect(200)
      .then(response => {
        challengeResp = response.body
      })

    const signature = sigUtil.personalSign(Buffer.from(testEthereumConstants.privKeyHex, 'hex'), { data: challengeResp.challenge })

    await request(app)
      .post('/users/login/challenge')
      .send({ data: challengeResp.challenge, signature })
      .expect(200)
  })

  it('allows user login', async function () {
    await createStarterCNodeUser()
    const ts = Math.round((new Date()).getTime() / 1000)
    const data = 'This is a message:' + ts.toString()
    const signature = sigUtil.personalSign(Buffer.from(testEthereumConstants.privKeyHex, 'hex'), { data })
    await request(app)
      .post('/users/login')
      .send({ data, signature })
      .expect(200)
  })

  it('login returns valid token', async function () {
    await createStarterCNodeUser()
    const ts = Math.round((new Date()).getTime() / 1000)
    const data = 'This is a message:' + ts.toString()
    const signature = sigUtil.personalSign(Buffer.from(testEthereumConstants.privKeyHex, 'hex'), { data })
    const resp = await request(app)
      .post('/users/login')
      .send({ data, signature })
      .expect(200)
    await request(app)
      .post('/users/logout')
      .set('X-Session-ID', resp.body.sessionToken)
      .send({})
      .expect(200)
  })

  it('login fails on invalid signature', async function () {
    await createStarterCNodeUser()
    const ts = Math.round((new Date()).getTime() / 1000)
    const data = 'This is a message:' + ts.toString()

    // a valid signature that is not correct for the given message / timestamp
    const signature = '0x9e52d9c37a36629fa0c91481cd0c8f7754a1401452188f663e54845d6088247f4c37c811183d5c946f75dc666553f0f271eeee1491bca8988b71b4de737b17c21b'

    await request(app)
      .post('/users/login')
      .send({ data, signature })
      .expect(400)
  })

  /* // will only log error
  it('login fails on old timestamp', async function () {
    await createStarterCNodeUser()
    const ts = Math.round((new Date()).getTime() / 1000) - 305
    const data = 'This is a message:' + ts.toString()
    const signature = sigUtil.personalSign(Buffer.from(testEthereumConstants.privKeyHex, 'hex'), { data })
    await request(app)
      .post('/users/login')
      .send({ data, signature })
      .expect(400)
  })
  */

  it('logout works', async function () {
    const session = await createStarterCNodeUser()
    await request(app)
      .post('/users/logout')
      .set('X-Session-ID', session)
      .send({})
      .expect(200)
    await request(app)
      .post('/users/logout')
      .set('X-Session-ID', session)
      .send({})
      .expect(401)
  })
})
