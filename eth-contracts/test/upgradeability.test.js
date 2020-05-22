import * as _lib from '../utils/lib.js'

const Registry = artifacts.require('Registry')
const Staking = artifacts.require('Staking')
const StakingUpgraded = artifacts.require('StakingUpgraded')
const AudiusToken = artifacts.require('AudiusToken')
const MockStakingCaller = artifacts.require('MockStakingCaller')
const AudiusAdminUpgradeabilityProxy = artifacts.require('AudiusAdminUpgradeabilityProxy')

const claimsManagerProxyKey = web3.utils.utf8ToHex('ClaimsManagerProxy')
const delegateManagerKey = web3.utils.utf8ToHex('DelegateManager')
const serviceProviderFactoryKey = web3.utils.utf8ToHex('ServiceProviderFactory')
const governanceKey = web3.utils.utf8ToHex('Governance')
const serviceTypeManagerProxyKey = web3.utils.utf8ToHex('ServiceTypeManagerProxy')

const DEFAULT_AMOUNT = _lib.audToWeiBN(120)


contract('Upgrade proxy test', async (accounts) => {
  let proxy
  let token
  let staking0
  let staking
  let stakingUpgraded
  let stakingInitializeData
  let mockStakingCaller
  let registry

  const [deployerAddress, proxyAdminAddress, proxyDeployerAddress] = accounts

  const approveAndStake = async (amount, staker, staking) => {
    // Transfer default tokens to
    await token.transfer(staker, amount, { from: deployerAddress })
    // allow Staking app to move owner tokens
    await token.approve(staking.address, amount, { from: staker })
    // stake tokens
    await mockStakingCaller.stakeFor(
      staker,
      amount)
  }

  beforeEach(async () => {
    token = await AudiusToken.new({ from: accounts[0] })
    await token.initialize()
    registry = await Registry.new()
    await registry.initialize()

    staking0 = await Staking.new({ from: proxyAdminAddress })
    stakingUpgraded = await StakingUpgraded.new({ from: proxyAdminAddress })
    assert.notEqual(staking0.address, stakingUpgraded.address)

    // Create initialization data
    stakingInitializeData = _lib.encodeCall(
      'initialize',
      ['address', 'address', 'bytes32', 'bytes32', 'bytes32'],
      [
        token.address,
        registry.address,
        claimsManagerProxyKey,
        delegateManagerKey,
        serviceProviderFactoryKey
      ]
    )

    proxy = await AudiusAdminUpgradeabilityProxy.new(
      staking0.address,
      proxyAdminAddress,
      stakingInitializeData,
      registry.address,
      governanceKey,
      { from: proxyDeployerAddress }
    )

    // Register mock contract as claimsManager, spFactory, delegateManager
    mockStakingCaller = await MockStakingCaller.new()
    await mockStakingCaller.initialize(proxy.address, token.address)
    await registry.addContract(claimsManagerProxyKey, mockStakingCaller.address)
    await registry.addContract(serviceProviderFactoryKey, mockStakingCaller.address)
    await registry.addContract(delegateManagerKey, mockStakingCaller.address)
    await registry.addContract(governanceKey, mockStakingCaller.address)
  })

  it('Fails to call Staking contract function before proxy initialization', async () => {
    const mock = await MockStakingCaller.new({ from: proxyAdminAddress })
    await _lib.assertRevert(
      mock.stakeRewards(10, accounts[5], { from: proxyDeployerAddress }),
      "INIT_NOT_INITIALIZED"
    )

    const isInitialized = await mock.isInitialized.call()
    assert.isFalse(isInitialized)
  })

  it('Deployed proxy state', async () => {
    staking = await Staking.at(proxy.address)

    const totalStaked = await staking.totalStaked.call({ from: proxyDeployerAddress })
    assert.equal(totalStaked, 0)

    const impl = await proxy.implementation.call({ from: proxyAdminAddress })
    assert.equal(impl, staking0.address)

  })

  it('fail to call newFunction before upgrade', async () => {
    staking = await StakingUpgraded.at(proxy.address)
    await _lib.assertRevert(staking.newFunction.call({ from: proxyDeployerAddress }), 'revert')
  })

  it('Fail to upgrade proxy from incorrect address', async () => {
    staking = await StakingUpgraded.at(proxy.address)

    await _lib.assertRevert(
      proxy.upgradeTo(stakingUpgraded.address),
      "Caller must be proxy admin or proxy upgrader"
    )
  })

  it('Fail to initialize proxy twice', async () => {
    await _lib.assertRevert(
      mockStakingCaller.initialize(proxy.address, token.address),
      "Contract instance has already been initialized"
    )
  })

  it('upgrade proxy to StakingUpgraded + call newFunction()', async () => {
    // assert proxy.newFunction() not callable before upgrade
    staking = await StakingUpgraded.at(proxy.address)
    await _lib.assertRevert(staking.newFunction.call({ from: proxyDeployerAddress }), 'revert')

    const upgradeTxReceipt = await proxy.upgradeTo(stakingUpgraded.address, { from: proxyAdminAddress })

    // Confirm event log
    const txParsed = _lib.parseTx(upgradeTxReceipt)
    assert.equal(txParsed.event.name, 'Upgraded', 'event.name')
    assert.equal(txParsed.event.args.implementation, stakingUpgraded.address, 'event.args.implementation')

    // Confirm proxy implementation's address has updated to new logic contract
    assert.equal(await proxy.implementation.call({ from: proxyAdminAddress }), stakingUpgraded.address)

    // assert proxy.newFunction() call succeeds after upgrade
    staking = await StakingUpgraded.at(proxy.address)
    const newFunctionResp = await staking.newFunction.call({ from: proxyDeployerAddress })
    assert.equal(newFunctionResp, 5)
  })

  it('Get & set contract registry', async () => {
    const registry2 = await Registry.new()
    await registry2.initialize()

    let proxyRegistry = await proxy.getAudiusRegistry.call({ from: proxyAdminAddress })
    assert.equal(proxyRegistry, registry.address)

    await proxy.setAudiusRegistry(registry2.address, { from: proxyAdminAddress })

    proxyRegistry = await proxy.getAudiusRegistry.call({ from: proxyAdminAddress })
    assert.equal(proxyRegistry, registry2.address)

    staking = await Staking.at(proxy.address)
    const totalStaked = await staking.totalStaked.call({ from: proxyDeployerAddress })
    assert.equal(totalStaked, 0)
    assert.equal(await proxy.implementation.call({ from: proxyAdminAddress }), staking0.address)
  })

  it('Get & set contract controller registry key', async () => {
    let controllerKey = await proxy.getControllerRegistryKey()
    assert.equal(_lib.toStr(controllerKey), _lib.toStr(governanceKey))

    await proxy.setControllerRegistryKey(delegateManagerKey, { from: proxyAdminAddress })

    controllerKey = await proxy.getControllerRegistryKey()
    assert.equal(_lib.toStr(controllerKey), _lib.toStr(delegateManagerKey))

    await _lib.assertRevert(
      proxy.setControllerRegistryKey(serviceTypeManagerProxyKey, { from: proxyAdminAddress }),
      "No contract registered for provided registry key"
    )
  })

  describe('Test with Staking contract', async () => {
    beforeEach(async () => {
      const spAccount1 = accounts[3]
      const spAccount2 = accounts[4]

      // Transfer 1000 tokens to accounts[1] and accounts[2]
      await token.transfer(spAccount1, 1000, { from: deployerAddress })
      await token.transfer(spAccount2, 1000, { from: deployerAddress })

      // Permission test address as caller
      staking = await Staking.at(proxy.address)
    })

    it('upgrade and confirm initial staking state at proxy', async () => {
      assert.equal(await proxy.implementation.call({ from: proxyAdminAddress }), staking0.address)
      assert.equal(await staking.token.call({ from: accounts[3] }), token.address, 'Token is wrong')
      assert.equal((await staking.totalStaked.call({ from: accounts[3] })).valueOf(), 0, 'Initial total staked amount should be zero')
      assert.equal(await staking.supportsHistory({ from: accounts[3] }), true, 'history support should match')
    })

    it('Confirm that contract state changes persist after proxy upgrade', async () => {
      const staker = accounts[3]
      const otherAccount = accounts[4]

      await approveAndStake(DEFAULT_AMOUNT, staker, staking)
      await proxy.upgradeTo(stakingUpgraded.address, { from: proxyAdminAddress })

      staking = await StakingUpgraded.at(proxy.address)

      assert.isTrue(
        DEFAULT_AMOUNT.eq(await staking.totalStaked.call({ from: otherAccount })),
        'total staked amount should transfer after upgrade'
      )

      assert.isTrue(
        DEFAULT_AMOUNT.eq(await staking.totalStakedFor.call(staker, { from: otherAccount })),
        'total staked for staker should match after upgrade'
      )
    })
  })
})