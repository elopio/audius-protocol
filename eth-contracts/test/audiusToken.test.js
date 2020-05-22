import * as _lib from '../utils/lib.js'
const AudiusToken = artifacts.require('AudiusToken')

contract('AudiusToken', async (accounts) => {
  // expected initial token values
  const NAME = "TestAudius"
  const SYMBOL = "TAUDS"
  const DECIMALS = 18  // standard - imitates relationship between Ether and Wei
  const INITIAL_SUPPLY = Math.pow(10,27) // 10^27 = 1 billion tokens, 18 decimal places

  let token
  const deployerAddress = accounts[0]

  beforeEach(async () => {
    token = await AudiusToken.new({ from: deployerAddress })
    await token.initialize()
  })

  it('Initial token properties', async () => {
    assert.equal(await token.name(), NAME)
    assert.equal(await token.symbol(), SYMBOL)
    assert.equal(await token.decimals(), DECIMALS)
    assert.equal(await token.totalSupply(), INITIAL_SUPPLY)
  })

  it('initial account balances', async () => {
    assert.equal(await token.balanceOf(deployerAddress), INITIAL_SUPPLY)
    assert.equal(await token.balanceOf(accounts[1]), 0)
  })

  it('Transfers', async () => {
    const amount = 1000
    // transfer
    await token.transfer(accounts[1], amount, {from: deployerAddress})
    assert.equal(await token.balanceOf(deployerAddress), INITIAL_SUPPLY - amount)
    assert.equal(await token.balanceOf(accounts[1]), amount)

    // fail to transfer above balance
    await _lib.assertRevert(
      token.transfer(accounts[2], 2*amount, {from: accounts[1]}),
      'transfer amount exceeds balance' 
    )
  })

  it('Burn from treasury', async () => {
    const burnAmount = Math.pow(10,3)

    // Confirm token state before burn
    assert.equal(await token.balanceOf(deployerAddress), INITIAL_SUPPLY)
    assert.equal(await token.totalSupply(), INITIAL_SUPPLY)

    // Decrease total supply by burning from treasury
    await token.burn(burnAmount, { from: deployerAddress })

    // Confirm token state after burn
    assert.equal(await token.balanceOf(deployerAddress), INITIAL_SUPPLY - burnAmount)
    assert.equal(await token.totalSupply(), INITIAL_SUPPLY - burnAmount)
  })

  it('Burn from account', async () => {
    const amount = Math.pow(10,3)
    const account = accounts[1]

    // Confirm token state before burn
    await token.transfer(account, amount, {from: deployerAddress})
    assert.equal(await token.balanceOf(deployerAddress), INITIAL_SUPPLY - amount)
    assert.equal(await token.balanceOf(account), amount)
    assert.equal(await token.totalSupply(), INITIAL_SUPPLY)
    
    // Decrease total supply by burning from account
    await token.approve(deployerAddress, amount, { from: account })
    await token.burnFrom(account, amount, { from: deployerAddress })

    // Confirm token state after burn
    assert.equal(await token.balanceOf(deployerAddress), INITIAL_SUPPLY - amount)
    assert.equal(await token.balanceOf(account), 0)
    assert.equal(await token.totalSupply(), INITIAL_SUPPLY - amount)
  })

  it('Mint', async () => {
    // mint tokens
    await token.mint(accounts[1], 1000, {from: deployerAddress})
    assert.equal(await token.balanceOf(deployerAddress), INITIAL_SUPPLY)
    assert.equal(await token.balanceOf(accounts[1]), 1000)
    assert.equal(await token.totalSupply(), INITIAL_SUPPLY + 1000)

    // fail to mint from non-minterRole
    let caughtError = false
    try {
      await token.mint(accounts[2], 1000, {from: accounts[2]})
    } catch (e) {
      // catch expected error
      if (e.message.indexOf('MinterRole: caller does not have the Minter role') >= 0) {
        caughtError = true
      } else {
        // throw on unexpected error
        throw e
      }
    }
    assert.isTrue(caughtError)

    // add new minter
    await token.addMinter(accounts[2], {from: deployerAddress})
    assert.isTrue(await token.isMinter(accounts[2]))
    assert.isFalse(await token.isMinter(accounts[3]))
    await token.mint(accounts[2], 1000, {from: accounts[2]})

    // renounce minter
    await token.renounceMinter({from: deployerAddress})

    // fail to mint from renounced minter
    caughtError = false
    try {
      await token.mint(accounts[4], 1000, {from: deployerAddress})
    } catch (e) {
      // catch expected error
      if (e.message.indexOf('MinterRole: caller does not have the Minter role') >= 0) {
        caughtError = true
      } else {
        // throw on unexpected error
        throw e
      }
    }
    assert.isTrue(caughtError)
  })

  it('Pause', async () => {
    // pause contract
    await token.pause({from: deployerAddress})
    assert.isTrue(await token.paused())

    // fail to transfer while contract paused
    let caughtError = false
    try {
      await token.transfer(accounts[1], 1000, {from: deployerAddress})
    } catch (e) {
      // catch expected error
      if (e.message.indexOf('Pausable: paused') >= 0) {
        caughtError = true
      } else {
        // throw on unexpected error
        throw e
      }
    }
    assert.isTrue(caughtError)

    // add new pauser
    await token.addPauser(accounts[5])
    assert.isTrue(await token.isPauser(deployerAddress))
    assert.isTrue(await token.isPauser(accounts[5]))

    // unpause contract
    await token.unpause({from: accounts[5]})
    assert.isFalse(await token.paused())

    // fail to pause contract from non-pauser
    caughtError = false
    try {
      await token.pause({from: accounts[8]})
    } catch (e) {
      // catch expected error
      if (e.message.indexOf('PauserRole: caller does not have the Pauser role') >= 0) {
        caughtError = true
      } else {
        // throw on unexpected error
        throw e
      }
    }
    assert.isTrue(caughtError)

    // renounce pauser
    await token.renouncePauser({from: deployerAddress})
    assert.isFalse(await token.isPauser(deployerAddress))
    assert.isTrue(await token.isPauser(accounts[5]))

    // fail to pause contract from renounced pauser
    caughtError = false
    try {
      await token.pause({from: deployerAddress})
    } catch (e) {
      // catch expected error
      if (e.message.indexOf('PauserRole: caller does not have the Pauser role') >= 0) {
        caughtError = true
      } else {
        // throw on unexpected error
        throw e
      }
    }
    assert.isTrue(caughtError)
  })
})
