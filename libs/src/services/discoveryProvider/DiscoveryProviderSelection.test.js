const nock = require('nock')
const assert = require('assert')
const semver = require('semver')

const DiscoveryProviderSelection = require('./DiscoveryProviderSelection')

const mockEthContracts = (urls, currrentVersion) => ({
  getCurrentVersion: async () => currrentVersion,
  getNumberOfVersions: async (spType) => 2,
  getVersion: async (spType, queryIndex) => {
    return ['1.2.2', '1.2.3'][queryIndex]
  },
  getServiceProviderList: async () => urls,
  isValidSPVersion: (version1, version2) => {
    return (
      semver.major(version1) === semver.major(version2) &&
      semver.minor(version1) === semver.minor(version2) &&
      semver.patch(version2) >= semver.patch(version1)
    )
  }
})

describe('DiscoveryProviderSelection', () => {
  beforeEach(() => {
    const LocalStorage = require('node-localstorage').LocalStorage
    const localStorage = new LocalStorage('./local-storage')
    localStorage.removeItem('@audius/libs:discovery-provider-timestamp')
  })

  it('selects a healthy service', async () => {
    const healthy = 'https://healthy.audius.co'
    nock(healthy)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })

    const s = new DiscoveryProviderSelection(
      {},
      mockEthContracts([healthy], '1.2.3')
    )
    const service = await s.select()
    assert.strictEqual(service, healthy)
  })

  it('selects a healthy service with an unhealthy one present', async () => {
    const healthy = 'https://healthy.audius.co'
    nock(healthy)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })
    const unhealthy = 'https://unhealthy.audius.co'
    nock(unhealthy)
      .get('/health_check')
      .reply(400, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })

    const s = new DiscoveryProviderSelection(
      {},
      mockEthContracts([healthy, unhealthy], '1.2.3')
    )
    const service = await s.select()
    assert.strictEqual(service, healthy)
  })

  it('prefers the correct vesion', async () => {
    const healthy = 'https://healthy.audius.co'
    nock(healthy)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })
    const outdated = 'https://outdated.audius.co'
    nock(outdated)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.2',
        block_difference: 0
      })

    const s = new DiscoveryProviderSelection(
      {},
      mockEthContracts([healthy, outdated], '1.2.3')
    )
    const service = await s.select()
    assert.strictEqual(service, healthy)
  })

  it('prefers a healthy block diff', async () => {
    const healthy = 'https://healthy.audius.co'
    nock(healthy)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })
    const behind = 'https://behind.audius.co'
    nock(behind)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 20
      })

    const s = new DiscoveryProviderSelection(
      {},
      mockEthContracts([healthy, behind], '1.2.3')
    )
    const service = await s.select()
    assert.strictEqual(service, healthy)
  })

  it('can select an old version', async () => {
    const healthyButBehind = 'https://healthyButBehind.audius.co'
    nock(healthyButBehind)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 20
      })
    const pastVersionNotBehind = 'https://pastVersionNotBehind.audius.co'
    nock(pastVersionNotBehind)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.2',
        block_difference: 0
      })

    const s = new DiscoveryProviderSelection(
      { requestTimeout: 100 },
      mockEthContracts([healthyButBehind, pastVersionNotBehind], '1.2.3')
    )
    const service = await s.select()
    assert.strictEqual(service, pastVersionNotBehind)
    assert.deepStrictEqual(s.backups, {
      [healthyButBehind]: {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 20
      },
      [pastVersionNotBehind]: {
        service: 'discovery-provider',
        version: '1.2.2',
        block_difference: 0
      }
    })
    assert.strictEqual(s.getTotalAttempts(), 2)
  })

  it('can select the discprov that is the least number of blocks behind for the current version', async () => {
    const behind20 = 'https://behind20.audius.co'
    nock(behind20)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.2',
        block_difference: 20
      })
    const behind40 = 'https://behind40.audius.co'
    nock(behind40)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 40
      })

    const s = new DiscoveryProviderSelection(
      { requestTimeout: 100 },
      mockEthContracts([behind20, behind40], '1.2.3')
    )
    const service = await s.select()
    assert.strictEqual(service, behind40)
    assert.deepStrictEqual(s.backups, {
      [behind20]: {
        service: 'discovery-provider',
        version: '1.2.2',
        block_difference: 20
      },
      [behind40]: {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 40
      }
    })
    assert.strictEqual(s.getTotalAttempts(), 2)
    assert.strictEqual(s.isInRegressedMode(), true)
  })

  it('will not pick a minor version behind provider', async () => {
    const minorBehind = 'https://minorBehind.audius.co'
    nock(minorBehind)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.1.3',
        block_difference: 20
      })
    const s = new DiscoveryProviderSelection(
      { requestTimeout: 100 },
      mockEthContracts([minorBehind], '1.2.3')
    )
    const service = await s.select()
    assert.strictEqual(service, null)
  })

  it('respects a whitelist', async () => {
    const healthy1 = 'https://healthy1.audius.co'
    nock(healthy1)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })

    const healthy2 = 'https://healthy2.audius.co'
    nock(healthy2)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })

    const s = new DiscoveryProviderSelection(
      {
        whitelist: new Set([healthy2])
      },
      mockEthContracts([healthy1, healthy2], '1.2.3')
    )
    const service = await s.select()
    assert.strictEqual(service, healthy2)
  })

  it('will cache its choice', async () => {
    const LocalStorage = require('node-localstorage').LocalStorage
    const localStorage = new LocalStorage('./local-storage')

    const healthy1 = 'https://healthy1.audius.co'
    nock(healthy1)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })

    const s = new DiscoveryProviderSelection(
      {},
      mockEthContracts([healthy1], '1.2.3')
    )
    const service = await s.select()
    assert.strictEqual(service, healthy1)
    const { endpoint } = JSON.parse(localStorage.getItem('@audius/libs:discovery-provider-timestamp'))
    assert.strictEqual(
      endpoint,
      healthy1
    )
  })

  it('will cache its choice and reuse it', async () => {
    const LocalStorage = require('node-localstorage').LocalStorage
    const localStorage = new LocalStorage('./local-storage')

    const healthy1 = 'https://healthy1.audius.co'
    nock(healthy1)
      .get('/health_check')
      .delay(100)
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })

    const healthy2 = 'https://healthy2.audius.co'
    nock(healthy2)
      .get('/health_check')
      .delay(100)
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })

    const initiallyUnhealthy = 'https://initiallyUnhealthy.audius.co'
    nock(initiallyUnhealthy)
      .get('/health_check')
      .reply(400, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })

    const s = new DiscoveryProviderSelection(
      {},
      mockEthContracts([healthy1, healthy2, initiallyUnhealthy], '1.2.3')
    )
    const firstService = await s.select()
    const { endpoint } = JSON.parse(localStorage.getItem('@audius/libs:discovery-provider-timestamp'))
    assert.strictEqual(
      endpoint,
      firstService
    )

    const secondService = await s.select()
    assert.strictEqual(firstService, secondService)

    const thirdService = await s.select()
    assert.strictEqual(firstService, thirdService)

    const fourthService = await s.select()
    assert.strictEqual(firstService, fourthService)

    // Clear the cached service
    s.clearUnhealthy()
    localStorage.removeItem('@audius/libs:discovery-provider-timestamp')

    // Make healthy1 start failing but healthy2 succeed
    nock(healthy1)
      .get('/health_check')
      .reply(400, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })
    nock(healthy2)
      .get('/health_check')
      .reply(400, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })
    nock(initiallyUnhealthy)
      .get('/health_check')
      .reply(200, {
        service: 'discovery-provider',
        version: '1.2.3',
        block_difference: 0
      })

    const fifthService = await s.select()
    assert.strictEqual(fifthService, initiallyUnhealthy)

    const sixthService = await s.select()
    assert.strictEqual(sixthService, initiallyUnhealthy)
  })
})
