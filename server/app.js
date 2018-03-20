/**
 * Server Application
 * perform complex actions delegated from client application
 */
import _ from 'lodash'
import Raw from '@graphiy/provider-raw'
import Util from '../core/util'

export default class Self {
  constructor (p) {
    this.rootKey = '000000001vGeH72LxVtxKg'
    this._itemtypes = ['tag', 'note']
    this._serviceItems = ['root', 'visibleItem', 'itemtype']
    this.serviceItem = {}
    this.p = p

    this.provider = Raw
    this._readGraph()
  }

  async _readGraph () {
    const graph = await this.provider.read(this.p.repository.path)
    this.graph = graph
    console.info(`Serving items total: ${graph.getItemKeys().length} from ${this.p.repository.path}`)
    this._initServiceItems()
  }

  _initServiceItems () {
    _.each(this._serviceItems.concat(this._itemtypes), (item) => {
      this.serviceItem[item] = this.graph.search(this.rootKey, item)[0]
    })
    this.serviceItem.root = this.rootKey
  }

  _changeItemsInStoradge (result) {
    _.each(result, (key) => {
      this.provider.set(key, this.graph.get(key), this.graph.getLinks(key), this.p)
    })
  }
  /**
   * Find Items by value from root
   * @param p
   */
  findNodesByTags (p) {
    return new Promise((resolve, reject) => {
      const args = JSON.parse(p)
      const tagsAnd = Util.pluralize(args.tagsAnd)
      const tagsOr = Util.pluralize(args.tagsOr)
      const serviceKeys = this.graph.find(this.rootKey)
      const itemsMap = {}
      let arrLinkedKeysOr = []
      let arrLinkedKeysAnd = []

      if (tagsOr.length > 0) {
        const tags = []
        _.each(tagsOr, (value) => {
          tags.push(this.graph.search(this.serviceItem.tag, value, 'g')[0])
        })
        arrLinkedKeysOr = _.map(tags, key => this.graph.getLinked(key))
        arrLinkedKeysOr = _.intersection(...arrLinkedKeysOr)
      }

      if (tagsAnd.length > 0) {
        const tags = []
        _.each(tagsAnd, (value) => {
          tags.push(this.graph.search(this.serviceItem.tag, value, 'g')[0])
        })
        arrLinkedKeysAnd = _.map(tags, key => this.graph.getLinked(key))
        arrLinkedKeysAnd = _.union(...arrLinkedKeysAnd)
      }

      const arrLinkedKeys = _.union(arrLinkedKeysOr, arrLinkedKeysAnd)
      _.pullAll(arrLinkedKeys, serviceKeys)

      _.each(arrLinkedKeys, (key) => {
        itemsMap[key] = this.graph.get(key)
      })

      resolve(itemsMap)
    })
  }
  /**
   * retrieves tags in select2 consumable format by search query
   * @param {String} query
   * @returns {Promise}
   */
  searchTags (query) {
    return new Promise((resolve, reject) => {
      const tagKeys = this.graph.search(this.serviceItem.tag, query, 'g')
      const serviceKeys = _.keys(this.serviceItem)
      _.pullAll(tagKeys, serviceKeys)

      const data = _.map(tagKeys, key => ({ id: key, text: this.graph.get(key) }))
      resolve(data)
    })
  }

  createAndLinkItem (linkedKeys) {
    const newKey = this.graph.set()
    const result = this.graph.associate(newKey, linkedKeys)
    this._changeItemsInStoradge(result)

    return Promise.resolve(newKey)
  }

  saveCoords (args) {
    const result = []
    const update = []
    const [serviseItem, coords] = args
    const paths = this.graph._getShotesPath(Object.keys(coords), serviseItem)
    // update coords
    if (paths.length > 0) {
      _.each(paths, (path) => {
        const amended = this.graph.set(JSON.stringify(coords[path[0]]), path[1])
        result.push(amended)
        delete coords[path[0]]
        update.push(path[0])
      })
    }
    // new coords
    _.each(coords, (value, key) => {
      const newKey = this.graph.set(JSON.stringify(value))
      const amended = this.graph.associate(newKey, [serviseItem, key])
      result.push(amended)
      update.push(key)
    })
    this._changeItemsInStoradge(_.flatten(result))
    return Promise.resolve(Object.keys(update))
  }

  getGraph (context, depth = 1) {
    const contextS = Util.pluralize(context)
    return Promise.resolve(this.graph.getGraph(contextS, depth))
  }

  getGraphWithIntersection (context, depth, key) {
    const contextS = Util.pluralize(context)
    return Promise.resolve(this.graph.getGraphWithIntersection(contextS, depth, key))
  }

  remove (keys) {
    const result = this.graph.remove(keys)
    this._changeItemsInStoradge(result)

    return Promise.resolve()
  }

  set (value, key) {
    this.graph.set(value, key)
    this.provider.set(key, this.graph.get(key), this.graph.getLinks(key), this.p)

    return Promise.resolve()
  }

  get (key) {
    return Promise.resolve(this.graph.get(key))
  }

  associate (source, target) {
    const result = this.graph.associate(source, target, 1, this.p)
    this._changeItemsInStoradge(result)

    return Promise.resolve()
  }

  setDisassociate (source, target) {
    const result = this.graph.disassociate(source, target)
    this._changeItemsInStoradge(result)

    return Promise.resolve()
  }

  merge (graph) {
    const result = this.graph.merge(graph)
    this._changeItemsInStoradge(result)

    return Promise.resolve()
  }
}
