import * as _lib from './_lib/lib.js'
import {
  Registry,
  UserStorage,
  UserFactory,
  UserReplicaSetManager
} from './_lib/artifacts.js'
import * as _constants from './utils/constants'
const { expectRevert } = require('@openzeppelin/test-helpers');

contract('UserReplicaSetManager', async (accounts) => {
  const verifierAddress = accounts[2]
  const userId1 = 1
  const userAcct1 = accounts[3]
  const userId2 = 2
  const userAcct2 = accounts[4]
  // First spID = 1, account = accounts[3]
  const cnode1SpID = 1
  const cnode1Account = accounts[5]
  // Second spID = 2, accounts = accounts[4]
  const cnode2SpID = 2
  const cnode2Account = accounts[6]
  // Third spID = 3, accounts = accounts[5]
  const cnode3SpID = 3
  const cnode3Account = accounts[7]
  // Fourth spID = 4, accounts = accounts[6]
  const cnode4SpID = 4
  const cnode4Account = accounts[8]

  // Contract objects
  let registry
  let userStorage
  let userFactory
  let userReplicaSetManager

  beforeEach(async () => {
    // init contract state
    registry = await Registry.new()
    const networkId = Registry.network_id

    // Add user storage and user factory
    userStorage = await UserStorage.new(registry.address)
    await registry.addContract(_constants.userStorageKey, userStorage.address)
    userFactory = await UserFactory.new(registry.address, _constants.userStorageKey, networkId, verifierAddress)
    await registry.addContract(_constants.userFactoryKey, userFactory.address)

    userReplicaSetManager = await UserReplicaSetManager.new(registry.address, _constants.userFactoryKey, networkId)
    await registry.addContract(_constants.userReplicaSetManagerKey, userReplicaSetManager.address)

    // Add 2 users
    await _lib.addUserAndValidate(
      userFactory,
      userId1,
      userAcct1,
      _constants.testMultihash.digest1,
      _constants.userHandle1,
      true)
    await _lib.addUserAndValidate(
      userFactory,
      userId2,
      userAcct2,
      _constants.testMultihash.digest1,
      _constants.userHandle2,
      true)

    // Setup cnode 1
    await registerCnode(cnode1SpID, cnode1Account)
    // Setup cnode 2
    await registerCnode(cnode2SpID, cnode2Account)
    // Setup cnode 3
    await registerCnode(cnode3SpID, cnode3Account)
  })

  /** Helper Functions **/
  let registerCnode = async (spID, delegateOwnerWallet) => {
    // Setup cnode
    let walletFromChain = await userReplicaSetManager.getCreatorNodeWallet(spID)
    assert.equal(walletFromChain, _constants.addressZero, 'Expect no wallet initially')
    await userReplicaSetManager.registerCreatorNode(spID, delegateOwnerWallet, { from: delegateOwnerWallet })
    walletFromChain = await userReplicaSetManager.getCreatorNodeWallet(spID)
    assert.equal(walletFromChain, delegateOwnerWallet, 'Expect wallet assignment')
    await expectRevert(
      userReplicaSetManager.registerCreatorNode(spID, delegateOwnerWallet, { from: delegateOwnerWallet }),
      'No value permitted'
    )
  }

  let updateReplicaSet = async (userId, newPrimary, newSecondaries, oldPrimary, oldSecondaries, senderAcct) => {
    await userReplicaSetManager.updateReplicaSet(
      userId, newPrimary, newSecondaries, oldPrimary, oldSecondaries,
      { from: senderAcct }
    )
    let replicaSetFromChain = await userReplicaSetManager.getArtistReplicaSet(userId)
    assert.isTrue(replicaSetFromChain.primary.eq(newPrimary), 'Primary mismatch')
    assert.isTrue(replicaSetFromChain.secondaries.every((replicaId, i) => replicaId.eq(newSecondaries[i])), 'Secondary mismatch')
  }

  /** Test Cases **/
  it('Add creator nodes', async () => {
    // Add cn4 through cn3
    await userReplicaSetManager.addCreatorNode(cnode4SpID, cnode4Account, cnode3SpID, cnode3Account, { from: cnode3Account })
    let walletFromChain = await userReplicaSetManager.getCreatorNodeWallet(cnode4SpID)
    assert.equal(walletFromChain, cnode4Account, 'Expect cn4 wallet assignment')
  })

  it('Configure artist replica set', async () => {
    const user1Primary = _lib.toBN(1)
    const user1Secondaries = _lib.toBNArray([2, 3])
    await updateReplicaSet(userId1, user1Primary, user1Secondaries, 0, [], userAcct1)
    // Fail with out of date prior configuration
    await expectRevert(
      updateReplicaSet(userId1, user1Primary, user1Secondaries, 0, [], userAcct1),
      'Invalid prior primary configuration'
    )
  })
})
