import Base from './base'
require('dotenv').config()
const API_URL = process.env.API_URL
//const { Base } = require('./base')

export default class WowApi extends Base {
    static getRealm (itemName, realmName) {
        return this.get(`${API_URL}?item_name=${itemName}&region=eu&realm_name=${realmName}`)
    }
}