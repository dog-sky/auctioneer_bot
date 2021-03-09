require('dotenv').config()
const axios  = require('axios')
const debounce = require('debounce')
const Telegraf = require('telegraf')
const Markup = require('telegraf/markup')
const Extra = require('telegraf/extra')
const SERVER_LIST = require('./store/serverList')
const HELPER = require('./helper/index')
const bot = new Telegraf(process.env.API_KEY_BOT)
const redis = require('redis')
const client = redis.createClient({host: process.env.REDIS_URL, port: process.env.REDIS_PORT, password: process.env.REDIS_PASS})
const apiUrl = process.env.API_URL
const apiMedia = process.env.API_MEDIA

let userServer = false
let hasServerMess = false

bot.start(({ reply }) =>
    reply('Привет! Установи сервер для поиска, потом ищи предмет по названию.', Markup
        .keyboard(SERVER_LIST.serverList.sort(), {columns: 2})
        .oneTime()
        .resize()
        .extra()
    )
)

bot.on('sticker', ctx => {
    const text = userServer ? 'Введите название предмаета текстом' : 'Сначала нужно установить сервер, а потом ввести название нужного предмета'
    ctx.reply(text)
})

bot.on('inline_query', (ctx) => {
    debounce(inlineQuery(ctx), 3000)
})

bot.on('text', async (ctx) => {
    client.get(ctx.from.id, function(err, redisServer) {
        checkServer(ctx, ctx.message.text)
        const hasServer = redisServer ? redisServer : userServer

        if (hasServer && !hasServerMess) {
            try {
                ctx.replyWithMarkdown("⌛️ Нужно немного подождать")
                const userText = ctx.message.text
                messageQuery(ctx, userText, false, hasServer)

            } catch (e) {
                ctx.reply('Не удалось получить ответ по такому запросу от сервера')
                ctx.reply(e)
            }
        } else if(!hasServerMess) {
            ctx.reply("Нужно указать сервер")
        }
    })
})

bot.command('setServer', ({ reply }) =>
    reply('Список серверов', Markup
        .keyboard(SERVER_LIST.serverList, {columns: 2})
        .oneTime()
        .resize()
        .extra()
    )
)

function checkServer (ctx, message) {
    hasServerMess = SERVER_LIST.serverList.includes(message)
    SERVER_LIST.serverList.map(server => {
        if (hasServerMess) {
            userServer = message
            if (server === message) {
                client.set(ctx.from.id, message, redis.print)
                ctx.reply(`Сервер ${ctx.message.text} установлен, можно искать предмет.`)
            }
        }
    })
}

function setPrice (item) {
    if (item[0].unit_price) {
     return {
         maxPrice: HELPER.goldFormat(item[0].unit_price),
         minPrice: HELPER.goldFormat(item.pop().unit_price)
     }
    } else {
        return {
            maxPrice: HELPER.goldFormat(item.pop().buyout),
            minPrice: HELPER.goldFormat(item[0].buyout)
        }
    }
}

const getAucData = async (url) => {
    try {
        const data = await axios({
            method: 'get',
            url: url,
            timeout: 8000,
        }).catch(() => [])
        return data
    } catch (e) {
        throw e
    }
}

async function inlineQuery (ctx) {
 client.get(ctx.from.id, async function(err, redisServer) {
    const hasServer = redisServer ? redisServer : userServer
    if (hasServer) {
        try {
            const productData = await messageQuery(ctx, ctx.update.inline_query.query, true, hasServer)
            const title = productData.globalText ? productData.globalText : 'ничего не удалось найти'
            const description = productData.maxPriceText ? `${productData.maxPriceText}\n\r${productData.minPriceText}` : ''
            const thumb_url = productData.mediaData ? productData.mediaData.data.assets[0].value : ''
            const payload = [
                {
                    'id': '001',
                    'type': 'article',
                    'title': title,
                    'description': `${description}\n\r`,
                    'thumb_url': thumb_url,
                    'thumb_width': 163,
                    'thumb_height': 182,
                    'message_text': `${ctx.update.inline_query.query}\n\r${title}\n\r${description}`
                }
            ]
            ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, payload, {cache_time: 0})
            ctx.answerInlineQuery(payload)
        } catch (e) {
            throw e
        }
    } else {
        const payload = [
            {
                'id': '001',
                'type': 'article',
                'title': 'Не установлен сервер для поиска предметов',
                'description': `Установите сервер зайдя в бота`,
                'message_text': `Установите сервер зайдя в бота'`
            }
        ]
        ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, payload)
    }
 })
}

async function messageQuery (ctx, userText, inline, hasUserServer) {
    try {
            const url = `${apiUrl}?item_name=${encodeURI(userText)}&region=eu&realm_name=${encodeURI(hasUserServer)}`

            const data = await getAucData(url)
            const itemList = data.data.result.map(item => item.item_name)
            const itemListLocal = itemList.map(item => item.ru_RU)
            const uniqItem = [...new Set(itemListLocal)]

            const specificItem = data.data.result.filter(product => {
                return product.item_name.ru_RU.toUpperCase() === userText.toUpperCase()
            })
            if (specificItem.length > 0) {
                const globalQty = specificItem.length
                const itemId = specificItem[0].item.id
                const price = setPrice(specificItem)
                const maxPrice = price.maxPrice
                const minPrice = price.minPrice
                const itemQuality = HELPER.getItemRank(specificItem[0].quality)
                const setItemQuality = itemQuality ? itemQuality : ''

                const mediaUrl = `${apiMedia}/${itemId}`
                const mediaData = await getAucData(mediaUrl)
                const globalText = `${setItemQuality} Общее количество товара - ${globalQty} лот${HELPER.plural(globalQty, ['', 'а', 'ов'])}`
                const minPriceText = `Минимальная цена: ${minPrice.gold}🟡  ${minPrice.silver}⚪️`
                const maxPriceText = `Максимальная цена: ${maxPrice.gold}🟡  ${maxPrice.silver}⚪️`


                if (!inline && mediaData) {
                    ctx.replyWithPhoto(mediaData.data.assets[0].value)
                    ctx.reply(globalText).then(res => {
                        ctx.reply(minPriceText)
                        ctx.reply(maxPriceText)
                    })
                } else {
                    const payload = {
                        mediaData: mediaData,
                        globalText: globalText,
                        minPriceText: minPriceText,
                        maxPriceText: maxPriceText
                    }
                    return payload
                }

            } else {
                if (!inline) {
                    ctx.reply(`Попробуйте сделать более точный запрос.`)
                    if (uniqItem.length > 1) {
                        <!-- TODO: список кнопками -->
                        // return ctx.reply('Вот что удалось найти', Extra.HTML().markup((m) =>
                        //     m.inlineKeyboard([
                        //         uniqItem.map(item => {
                        //            return m.callbackButton(item, item)
                        //         })
                        //     ], {parse_mode: 'Markdown'})))
                        ctx.reply(`Вот что удалось найти: ${uniqItem.join(', ')}`)
                    }
                } else {
                    return false
                }
            }
    } catch (e) {
        ctx.reply(`Не удалось найти предметы по запросу ${userText}`)
    }
}
bot.launch()