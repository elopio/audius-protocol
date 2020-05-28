const axios = require('axios')

class IdentityService {
  constructor (identityServiceEndpoint) {
    this.identityServiceEndpoint = identityServiceEndpoint
  }

  /* ------- HEDGEHOG AUTH ------- */

  async getFn (obj) {
    return this._makeRequest({
      url: '/authentication',
      method: 'get',
      params: obj
    })
  }

  async setAuthFn (obj) {
    return this._makeRequest({
      url: '/authentication',
      method: 'post',
      data: obj
    })
  }

  async setUserFn (obj) {
    return this._makeRequest({
      url: '/user',
      method: 'post',
      data: obj
    })
  }

  async getUserEvents (walletAddress) {
    return this._makeRequest({
      url: '/userEvents',
      method: 'get',
      params: { walletAddress }
    })
  }

  async sendRecoveryInfo (obj) {
    return this._makeRequest({
      url: '/recovery',
      method: 'post',
      data: obj
    })
  }

  /**
   * Check if an email address has been previously registered.
   * @param {string} email
   * @returns {{exists: boolean}}
   */
  async checkIfEmailRegistered (email) {
    return this._makeRequest({
      url: '/users/check',
      method: 'get',
      params: {
        email: email
      }
    })
  }

  /**
   * Associates a user with a twitter uuid.
   * @param {string} uuid from the Twitter API
   * @param {number} userId
   * @param {string} handle User handle
   */
  async associateTwitterUser (uuid, userId, handle) {
    return this._makeRequest({
      url: `/twitter/associate`,
      method: 'post',
      data: {
        uuid,
        userId,
        handle
      }
    })
  }

  /**
   * Associates a user with an instagram uuid.
   * @param {string} uuid from the Instagram API
   * @param {number} userId
   * @param {string} handle
   */
  async associateInstagramUser (uuid, userId, handle) {
    return this._makeRequest({
      url: `/instagram/associate`,
      method: 'post',
      data: {
        uuid,
        userId,
        handle
      }
    })
  }

  /**
   * Logs a track listen for a given user id.
   * @param {number} trackId
   * @param {number} userId
   */
  async logTrackListen (trackId, userId) {
    return this._makeRequest({
      url: `/tracks/${trackId}/listen`,
      method: 'post',
      data: {
        userId: userId
      }
    })
  }

  /**
   * Return listen history tracks for a given user id.
   * @param {number} userID - User ID
   * @param {number} limit - max # of items to return
   * @param {number} offset - offset into list to return from (for pagination)
   */
  async getListenHistoryTracks (userId, limit = 100, offset = 0) {
    let req = {
      method: 'get',
      url: '/tracks/history',
      params: { userId, limit, offset }
    }
    return this._makeRequest(req)
  }

  /**
   * Looks up a Twitter account by handle.
   * @returns {Object} twitter API response.
   */
  async lookupTwitterHandle (handle) {
    if (handle) {
      return this._makeRequest({
        url: '/twitter/handle_lookup',
        method: 'get',
        params: { handle: handle }
      })
    } else {
      throw new Error('No handle passed into function lookupTwitterHandle')
    }
  }

  /**
   * Gets tracks trending on Audius.
   * @param {string} timeFrame one of day, week, month, or year
   * @param {?Array<number>} idsArray track ids
   * @param {?number} limit
   * @param {?number} offset
   * @returns {{listenCounts: Array<{trackId:number, listens:number}>}}
   */
  async getTrendingTracks (timeFrame = null, idsArray = null, limit = null, offset = null) {
    let queryUrl = '/tracks/trending/'

    if (timeFrame != null) {
      switch (timeFrame) {
        case 'day':
        case 'week':
        case 'month':
        case 'year':
          break
        default:
          throw new Error('Invalid timeFrame value provided')
      }
      queryUrl += timeFrame
    }

    let queryParams = {}
    if (idsArray !== null) {
      queryParams['id'] = idsArray
    }

    if (limit !== null) {
      queryParams['limit'] = limit
    }

    if (offset !== null) {
      queryParams['offset'] = offset
    }

    return this._makeRequest({
      url: queryUrl,
      method: 'get',
      params: queryParams
    })
  }

  /**
   * Gets listens for tracks bucketted by timeFrame.
   * @param {string} timeFrame one of day, week, month, or year
   * @param {?Array<number>} idsArray track ids
   * @param {?string} startTime parseable by Date.parse
   * @param {?string} endTime parseable by Date.parse
   * @param {?number} limit
   * @param {?number} offset
   * @returns {{bucket:Array<{trackId:number, date:bucket, listens:number}>}}
   */
  async getTrackListens (timeFrame = null, idsArray = null, startTime = null, endTime = null, limit = null, offset = null) {
    let queryUrl = '/tracks/listens/'

    if (timeFrame != null) {
      switch (timeFrame) {
        case 'day':
        case 'week':
        case 'month':
        case 'year':
        case 'millennium':
          break
        default:
          throw new Error('Invalid timeFrame value provided')
      }
      queryUrl += timeFrame
    }

    let queryParams = {}
    if (idsArray !== null) {
      queryParams['id'] = idsArray
    }

    if (limit !== null) {
      queryParams['limit'] = limit
    }

    if (offset !== null) {
      queryParams['offset'] = offset
    }

    if (startTime != null) {
      queryParams['start'] = startTime
    }

    if (endTime != null) {
      queryParams['end'] = endTime
    }

    return this._makeRequest({
      url: queryUrl,
      method: 'get',
      params: queryParams
    })
  }

  async createUserRecord (email, walletAddress) {
    return this._makeRequest({
      url: '/user',
      method: 'post',
      data: {
        username: email,
        walletAddress
      }
    })
  }

  async relay (contractRegistryKey, contractAddress, senderAddress, encodedABI, gasLimit) {
    return this._makeRequest({
      url: '/relay',
      method: 'post',
      data: {
        contractRegistryKey,
        contractAddress,
        senderAddress,
        encodedABI,
        gasLimit
      }
    })
  }
  /* ------- INTERNAL FUNCTIONS ------- */

  async _makeRequest (axiosRequestObj) {
    axiosRequestObj.baseURL = this.identityServiceEndpoint

    // Axios throws for non-200 responses
    try {
      const resp = await axios(axiosRequestObj)
      return resp.data
    } catch (e) {
      if (e.response && e.response.data && e.response.data.error) {
        throw new Error(`Server returned error: [${e.response.status.toString()}] ${e.response.data.error}`)
      }
      throw e
    }
  }
}

module.exports = IdentityService
