const { pick } = require('lodash')
const { Base, Services } = require('./base')
const Utils = require('../utils')
const CreatorNode = require('../services/creatorNode')

const USER_PROPS = [
  'is_creator',
  'is_verified',
  'name',
  'handle',
  'profile_picture',
  'profile_picture_sizes',
  'cover_photo',
  'cover_photo_sizes',
  'bio',
  'location',
  'creator_node_endpoint'
]
const USER_REQUIRED_PROPS = [
  'name',
  'handle'
]

class Users extends Base {
  /* ----------- GETTERS ---------- */

  /**
   * get users with all relevant user data
   * can be filtered by providing an integer array of ids
   * @param {number} limit
   * @param {number} offset
   * @param {Object} idsArray
   * @param {String} walletAddress
   * @param {String} handle
   * @param {Boolean} isCreator null returns all users, true returns creators only, false returns users only
   * @param {number} currentUserId the currently logged in user
   * @returns {Object} {Array of User metadata Objects}
   * additional metadata fields on user objects:
   *  {Integer} track_count - track count for given user
   *  {Integer} playlist_count - playlist count for given user
   *  {Integer} album_count - album count for given user
   *  {Integer} follower_count - follower count for given user
   *  {Integer} followee_count - followee count for given user
   *  {Integer} repost_count - repost count for given user
   *  {Integer} track_blocknumber - blocknumber of latest track for user
   *  {Boolean} does_current_user_follow - does current user follow given user
   *  {Array} followee_follows - followees of current user that follow given user
   * @example
   * await getUsers()
   * await getUsers(100, 0, [3,2,6]) - Invalid user ids will not be accepted
   */
  async getUsers (limit = 100, offset = 0, idsArray = null, walletAddress = null, handle = null, isCreator = null, minBlockNumber = null) {
    this.REQUIRES(Services.DISCOVERY_PROVIDER)
    return this.discoveryProvider.getUsers(limit, offset, idsArray, walletAddress, handle, isCreator, minBlockNumber)
  }

  /**
   * get intersection of users that follow followeeUserId and users that are followed by followerUserId
   * @param {number} followeeUserId user that is followed
   * @example
   * getMutualFollowers(100, 0, 1, 1) - IDs must be valid
   */
  async getMutualFollowers (limit = 100, offset = 0, followeeUserId) {
    this.REQUIRES(Services.DISCOVERY_PROVIDER)
    const followerUserId = this.userStateManager.getCurrentUserId()
    if (followerUserId) {
      return this.discoveryProvider.getFollowIntersectionUsers(limit, offset, followeeUserId, followerUserId)
    }
    return []
  }

  /**
   * get users that follow followeeUserId, sorted by follower count descending
   * @param {number} currentUserId the currently logged in user
   * @param {number} followeeUserId user that is followed
   * @return {Array} array of user objects with standard user metadata
   */
  async getFollowersForUser (limit = 100, offset = 0, followeeUserId) {
    this.REQUIRES(Services.DISCOVERY_PROVIDER)
    return this.discoveryProvider.getFollowersForUser(limit, offset, followeeUserId)
  }

  /**
   * get users that are followed by followerUserId, sorted by follower count descending
   * @param {number} currentUserId the currently logged in user
   * @param {number} followerUserId user - i am the one who follows
   * @return {Array} array of user objects with standard user metadata
   */
  async getFolloweesForUser (limit = 100, offset = 0, followerUserId) {
    this.REQUIRES(Services.DISCOVERY_PROVIDER)
    return this.discoveryProvider.getFolloweesForUser(limit, offset, followerUserId)
  }

  /**
   * Return repost feed for requested user
   * @param {number} userId - requested user id
   * @param {filter} string - filter by "all", "original", or "repost"
   * @param {number} limit - max # of items to return (for pagination)
   * @param {number} offset - offset into list to return from (for pagination)
   * @returns {Object} {Array of track and playlist metadata objects}
   * additional metadata fields on track and playlist objects:
   *  {String} activity_timestamp - timestamp of requested user's repost for given track or playlist,
   *    used for sorting feed
   *  {Integer} repost_count - repost count of given track/playlist
   *  {Integer} save_count - save count of given track/playlist
   *  {Boolean} has_current_user_reposted - has current user reposted given track/playlist
   *  {Array} followee_reposts - followees of current user that have reposted given track/playlist
   */
  async getUserRepostFeed (userId, filter, limit = 100, offset = 0, withUsers = false) {
    this.REQUIRES(Services.DISCOVERY_PROVIDER)
    return this.discoveryProvider.getUserRepostFeed(userId, filter, limit, offset, withUsers)
  }

  /**
   * Return social feed for current user
   * @param {number} limit - max # of items to return
   * @param {filter} string - filter by "all", "original", or "repost"
   * @param {number} offset - offset into list to return from (for pagination)
   * @returns {Object} {Array of track and playlist metadata objects}
   * additional metadata fields on track and playlist objects:
   *  {String} activity_timestamp - timestamp of requested user's repost for given track or playlist,
   *    used for sorting feed
   *  {Integer} repost_count - repost count of given track/playlist
   *  {Integer} save_count - save count of given track/playlist
   *  {Boolean} has_current_user_reposted - has current user reposted given track/playlist
   *  {Array} followee_reposts - followees of current user that have reposted given track/playlist
   */
  async getSocialFeed (filter, limit = 100, offset = 0, withUsers = false, tracksOnly = false) {
    this.REQUIRES(Services.DISCOVERY_PROVIDER)
    const owner = this.userStateManager.getCurrentUser()
    if (owner) {
      return this.discoveryProvider.getSocialFeed(filter, limit, offset, withUsers, tracksOnly)
    }

    return []
  }

  /**
   * Returns the top users for the specified genres
   * @param {number} limit - max # of items to return
   * @param {number} offset - offset into list to return from (for pagination)
   * @param {Object} {Array of genres} - filter by genres ie. "Rock", "Alternative"
   * @param {Boolean} with_users - If the userIds should be returned or the full user metadata
   * @returns {Object} {Array of user objects if with_users set, else array of userIds}
   */
  async getTopCreatorsByGenres (genres, limit = 30, offset = 0, withUsers = false) {
    this.REQUIRES(Services.DISCOVERY_PROVIDER)
    return this.discoveryProvider.getTopCreatorsByGenres(genres, limit, offset, withUsers)
  }

  /* ------- SETTERS ------- */

  /**
   * Util to upload profile picture and cover photo images and update
   * a metadata object
   * @param {?File} profilePictureFile an optional file to upload as the profile picture
   * @param {?File} coverPhotoFile an optional file to upload as the cover phtoo
   * @param {Object} metadata to update
   * @returns {Object} the passed in metadata object with profile_picture and cover_photo fields added
   */
  async uploadProfileImages (profilePictureFile, coverPhotoFile, metadata) {
    if (profilePictureFile) {
      const resp = await this.creatorNode.uploadImage(profilePictureFile, true)
      metadata.profile_picture_sizes = resp.dirCID
    }
    if (coverPhotoFile) {
      const resp = await this.creatorNode.uploadImage(coverPhotoFile, false)
      metadata.cover_photo_sizes = resp.dirCID
    }
    return metadata
  }

  /**
   * Create an on-chain non-creator user. Some fields are restricted (ex.
   * creator_node_endpoint); this should error if the metadata given attempts to set them.
   * @param {Object} metadata metadata to associate with the user
   */
  async addUser (metadata) {
    this.IS_OBJECT(metadata)
    const newMetadata = this._cleanUserMetadata(metadata)
    this._validateUserMetadata(newMetadata)

    newMetadata.wallet = this.web3Manager.getWalletAddress()

    let userId
    const currentUser = this.userStateManager.getCurrentUser()
    if (currentUser && currentUser.handle) {
      userId = currentUser.user_id
    } else {
      userId = (await this.contracts.UserFactoryClient.addUser(newMetadata.handle)).userId
    }
    await this._addUserOperations(userId, newMetadata)

    this.userStateManager.setCurrentUser({ ...newMetadata })
    return userId
  }

  /**
   * Updates a user
   * @param {number} userId
   * @param {Object} metadata
   */
  async updateUser (userId, metadata) {
    this.REQUIRES(Services.DISCOVERY_PROVIDER)
    this.IS_OBJECT(metadata)
    const newMetadata = this._cleanUserMetadata(metadata)
    this._validateUserMetadata(newMetadata)

    // Retrieve the current user metadata
    let users = await this.discoveryProvider.getUsers(1, 0, [userId], null, null, false, null)
    if (!users || !users[0]) throw new Error(`Cannot update user because no current record exists for user id ${userId}`)

    const oldMetadata = users[0]
    await this._updateUserOperations(newMetadata, oldMetadata, userId)
    this.userStateManager.setCurrentUser({ ...oldMetadata, ...newMetadata })
  }

  /**
   * Create a new user that is a creator or upgrade from a non-creator user to a creator
   * Fills in wallet and creator_node_endpoint fields in metadata.
   *
   * @param {Object} metadata - metadata to associate with the user, following the format in `user-metadata-format.json` in audius-contracts.
   */
  async addCreator (metadata) {
    this.REQUIRES(Services.CREATOR_NODE)
    this.IS_OBJECT(metadata)
    const newMetadata = this._cleanUserMetadata(metadata)
    this._validateUserMetadata(newMetadata)

    // We only support one user per creator node / libs instance
    const user = this.userStateManager.getCurrentUser()
    if (user) {
      throw new Error('User already created for creator node / libs instance')
    }

    newMetadata.wallet = this.web3Manager.getWalletAddress()
    newMetadata.is_creator = true
    newMetadata.creator_node_endpoint = this.creatorNode.getEndpoint()

    // Upload metadata
    const { metadataMultihash, metadataFileUUID } = await this.creatorNode.uploadCreatorContent(
      newMetadata
    )
    // Write metadata to chain
    const multihashDecoded = Utils.decodeMultihash(metadataMultihash)
    const { userId, txReceipt } = await this.contracts.UserFactoryClient.addUser(
      newMetadata.handle
    )
    await this.contracts.UserFactoryClient.updateMultihash(userId, multihashDecoded.digest)
    const { latestBlockNumber } = await this._addUserOperations(userId, newMetadata)
    // Associate the user id with the metadata and block number
    await this.creatorNode.associateCreator(userId, metadataFileUUID, Math.max(txReceipt.blockNumber, latestBlockNumber))

    this.userStateManager.setCurrentUser({ ...newMetadata })
    return userId
  }

  /**
   * Updates a creator (updates their data on the creator node)
   * @param {number} userId
   * @param {Object} metadata
   */
  async updateCreator (userId, metadata) {
    this.REQUIRES(Services.CREATOR_NODE, Services.DISCOVERY_PROVIDER)
    this.IS_OBJECT(metadata)
    const newMetadata = this._cleanUserMetadata(metadata)
    this._validateUserMetadata(newMetadata)

    const user = this.userStateManager.getCurrentUser()
    if (!user) {
      throw new Error('No current user')
    }
    const oldMetadata = { ...user }

    // Upload new metadata
    const { metadataMultihash, metadataFileUUID } = await this.creatorNode.uploadCreatorContent(
      newMetadata
    )
    // Update new metadata on chain
    let updatedMultihashDecoded = Utils.decodeMultihash(metadataMultihash)
    const { txReceipt } = await this.contracts.UserFactoryClient.updateMultihash(userId, updatedMultihashDecoded.digest)
    const { latestBlockNumber } = await this._updateUserOperations(newMetadata, oldMetadata, userId)
    if (newMetadata.creator_node_endpoint !== oldMetadata.creator_node_endpoint) {
      await this._waitForCreatorNodeUpdate(newMetadata.user_id, newMetadata.creator_node_endpoint)
    }
    // Re-associate the user id with the metadata and block number
    await this.creatorNode.associateCreator(userId, metadataFileUUID, Math.max(txReceipt.blockNumber, latestBlockNumber))

    this.userStateManager.setCurrentUser({ ...oldMetadata, ...newMetadata })
    return userId
  }

  /**
   * Upgrades a user to a creator using their metadata object.
   * This creates a record for that user on the connected creator node.
   * @param {string} existingEndpoint
   * @param {string} newCreatorNodeEndpoint comma delineated
   */
  async upgradeToCreator (existingEndpoint, newCreatorNodeEndpoint) {
    if (!newCreatorNodeEndpoint) throw new Error(`No creator node endpoint provided`)

    this.REQUIRES(Services.CREATOR_NODE)

    const user = this.userStateManager.getCurrentUser()
    if (!user) {
      throw new Error('No current user')
    }
    // No-op if the user is already a creator.
    // Consider them a creator iff they have is_creator=true AND a creator node endpoint
    if (user.is_creator && user.creator_node_endpoint) return

    const userId = user.user_id
    const oldMetadata = { ...user }
    const newMetadata = this._cleanUserMetadata({ ...user })
    this._validateUserMetadata(newMetadata)

    newMetadata.wallet = this.web3Manager.getWalletAddress()
    newMetadata.is_creator = true
    newMetadata.creator_node_endpoint = newCreatorNodeEndpoint

    const newPrimary = CreatorNode.getPrimary(newCreatorNodeEndpoint)
    // Sync the new primary from from the node that has the user's data
    if (existingEndpoint) {
      // Don't validate what we're sycing from because the user isn't
      // a creator yet.
      await this.creatorNode.syncSecondary(
        newPrimary,
        existingEndpoint,
        /* immediate= */ true,
        /* validate= */ false
      )
    }

    await this.creatorNode.setEndpoint(newPrimary)

    // Upload new metadata
    const { metadataMultihash, metadataFileUUID } = await this.creatorNode.uploadCreatorContent(
      newMetadata
    )
    // Update new metadata on chain
    let updatedMultihashDecoded = Utils.decodeMultihash(metadataMultihash)
    const { txReceipt } = await this.contracts.UserFactoryClient.updateMultihash(userId, updatedMultihashDecoded.digest)
    const { latestBlockNumber } = await this._updateUserOperations(newMetadata, oldMetadata, userId)
    if (newMetadata.creator_node_endpoint !== oldMetadata.creator_node_endpoint) {
      await this._waitForCreatorNodeUpdate(newMetadata.user_id, newMetadata.creator_node_endpoint)
    }
    // Re-associate the user id with the metadata and block number
    await this.creatorNode.associateCreator(userId, metadataFileUUID, Math.max(txReceipt.blockNumber, latestBlockNumber))

    this.userStateManager.setCurrentUser({ ...oldMetadata, ...newMetadata })
    return userId
  }

  /**
   * Updates a user on whether they are verified on Audius
   * @param {number} userId
   * @param {boolean} isVerified
   */
  async updateIsVerified (userId, isVerified, privateKey) {
    return this.contracts.UserFactoryClient.updateIsVerified(userId, isVerified, privateKey)
  }

  /**
   * Adds a user follow for a given follower and followee
   * @param {number} followerUserId who is following
   * @param {number} followeeUserId who is being followed...
  */
  async addUserFollow (followeeUserId) {
    const followerUserId = this.userStateManager.getCurrentUserId()
    return this.contracts.SocialFeatureFactoryClient.addUserFollow(followerUserId, followeeUserId)
  }

  /**
   * Deletes a user follow for a given follower and followee
   * @param {number} followerUserId who is no longer following
   * @param {number} followeeUserId who is no longer being followed...
  */
  async deleteUserFollow (followeeUserId) {
    const followerUserId = this.userStateManager.getCurrentUserId()
    return this.contracts.SocialFeatureFactoryClient.deleteUserFollow(followerUserId, followeeUserId)
  }

  /* ------- PRIVATE  ------- */

  /** Waits for a discovery provider to confirm that a creator node endpoint is updated. */
  async _waitForCreatorNodeUpdate (userId, creatorNodeEndpoint) {
    let isUpdated = false
    while (!isUpdated) {
      const user = (await this.discoveryProvider.getUsers(1, 0, [userId]))[0]
      if (user.creator_node_endpoint === creatorNodeEndpoint) isUpdated = true
      await Utils.wait(500)
    }
  }

  async _addUserOperations (userId, metadata) {
    let addOps = []

    if (metadata['name']) {
      addOps.push(this.contracts.UserFactoryClient.updateName(userId, metadata['name']))
    }
    if (metadata['location']) {
      addOps.push(this.contracts.UserFactoryClient.updateLocation(userId, metadata['location']))
    }
    if (metadata['bio']) {
      addOps.push(this.contracts.UserFactoryClient.updateBio(userId, metadata['bio']))
    }
    if (metadata['profile_picture_sizes']) {
      addOps.push(this.contracts.UserFactoryClient.updateProfilePhoto(
        userId,
        Utils.decodeMultihash(metadata['profile_picture_sizes']).digest
      ))
    }
    if (metadata['cover_photo_sizes']) {
      addOps.push(this.contracts.UserFactoryClient.updateCoverPhoto(
        userId,
        Utils.decodeMultihash(metadata['cover_photo_sizes']).digest
      ))
    }
    if (metadata['is_creator']) {
      addOps.push(this.contracts.UserFactoryClient.updateIsCreator(userId, metadata['is_creator']))
    }
    if (metadata['creator_node_endpoint']) {
      addOps.push(this.contracts.UserFactoryClient.updateCreatorNodeEndpoint(userId, metadata['creator_node_endpoint']))
    }

    // Execute update promises concurrently
    // TODO - what if one or more of these fails?
    const ops = await Promise.all(addOps)
    return { ops: ops, latestBlockNumber: Math.max(...ops.map(op => op.txReceipt.blockNumber)) }
  }

  async _updateUserOperations (metadata, currentMetadata, userId) {
    let updateOps = []

    // Compare the existing metadata with the new values and conditionally
    // perform update operations
    for (const key in metadata) {
      if (metadata.hasOwnProperty(key) && currentMetadata.hasOwnProperty(key) && metadata[key] !== currentMetadata[key]) {
        if (key === 'name') {
          updateOps.push(this.contracts.UserFactoryClient.updateName(userId, metadata['name']))
        }
        if (key === 'is_creator') {
          updateOps.push(this.contracts.UserFactoryClient.updateIsCreator(userId, metadata['is_creator']))
        }
        if (key === 'bio') {
          updateOps.push(this.contracts.UserFactoryClient.updateBio(userId, metadata['bio']))
        }
        if (key === 'location') {
          updateOps.push(this.contracts.UserFactoryClient.updateLocation(userId, metadata['location']))
        }
        if (key === 'profile_picture_sizes') {
          updateOps.push(this.contracts.UserFactoryClient.updateProfilePhoto(
            userId,
            Utils.decodeMultihash(metadata['profile_picture_sizes']).digest
          ))
        }
        if (key === 'cover_photo_sizes') {
          updateOps.push(this.contracts.UserFactoryClient.updateCoverPhoto(
            userId,
            Utils.decodeMultihash(metadata['cover_photo_sizes']).digest
          ))
        }
        if (key === 'creator_node_endpoint') {
          updateOps.push(this.contracts.UserFactoryClient.updateCreatorNodeEndpoint(userId, metadata['creator_node_endpoint']))
        }
      }
    }

    const ops = await Promise.all(updateOps)
    return { ops: ops, latestBlockNumber: Math.max(...ops.map(op => op.txReceipt.blockNumber)) }
  }

  _validateUserMetadata (metadata) {
    this.OBJECT_HAS_PROPS(metadata, USER_PROPS, USER_REQUIRED_PROPS)
  }

  _cleanUserMetadata (metadata) {
    return pick(metadata, USER_PROPS.concat('user_id'))
  }
}

module.exports = Users
