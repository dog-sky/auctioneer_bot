import axios from 'axios'
//const { axios } = require('axios')

const RETRY_COUNT = 2
export default class Base {
    static request (method, url, { params, data } = null, options = {}) {
        return axios({
            method,
            url,
            data,
            params,
            ...options
        }).then(response => {
            if (options.withHeader) {
                return response
            }
            return response.data
        }).catch(err => {
            // Перезапрос данных если пришла 500 с сервера
            const status = err?.response?.status
            const counter = options.counter ?? 0
            if ((status >= 500 || status === 418) && counter < RETRY_COUNT) {
                const updatedOptions = assoc('counter', counter + 1, options)
                return this.request(method, url, { params, data }, updatedOptions)
            }
            throw err
        })
    }

    static get (url, params, options) {
        return this.request('get', url, { params }, options)
    }

    static post (url, data, options) {
        return this.request('post', url, { data }, options)
    }
}