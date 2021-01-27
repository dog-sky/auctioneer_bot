require('dotenv').config()
const axios  = require('axios');
const Telegraf = require('telegraf');
const Markup = require('telegraf/markup')
const Extra = require('telegraf/extra')
const SERVER_LIST = require('./store/serverList')
const HELPER = require('./helper/index')
const bot = new Telegraf(process.env.API_KEY_BOT)
const apiUrl = process.env.API_URL
const apiMedia = process.env.API_MEDIA

let userServer = null

bot.start( ctx => ctx.reply(`Привет ${ctx.from.first_name}! Введи команду /commandLine для получения панели команд.`))

bot.command('commandLine', ({ reply }) =>
    reply('Панель команд', Markup
        .keyboard(['/auction'])
        .oneTime()
        .resize()
        .extra()
    )
)

bot.command('setServer', ({ reply }) =>
    reply('Список серверов', Markup
        .keyboard(SERVER_LIST.serverList, {columns: 2})
        .oneTime()
        .resize()
        .extra()
    )
)

bot.command('auction',  (line) => {
    const infoText = userServer ? 'Введите название предмета' : 'Выбирите сервер через команду /setServer'
    line.replyWithMarkdown(infoText);
    bot.on("text", async (ctx) => {
        const hasServerMess = SERVER_LIST.serverList.includes(ctx.message.text)
        SERVER_LIST.serverList.map(server => {
            if (hasServerMess) {
                userServer = ctx.message.text
                if (server === ctx.message.text) {
                    ctx.reply(`Сервер ${ctx.message.text} установлен, можно искать предмет через /auction`)
                }
            }
        })
        if (userServer && !hasServerMess) {
            try {
                ctx.replyWithMarkdown("⌛️ Нужно немного подождать");
                const userText = ctx.message.text
                const url = `${apiUrl}?item_name=${encodeURI(userText)}&region=eu&realm_name=${encodeURI(userServer)}`

                const data = await getAucData(url)
                const itemList = data.data.result.map(item => item.item_name)
                const itemListLocal = itemList.map(item => item.ru_RU)
                const uniqItem = [...new Set(itemListLocal)]

                const specificItem = data.data.result.filter(product => {
                    return product.item_name.ru_RU.toUpperCase() === userText.toUpperCase()
                })
                if (specificItem.length > 0) {
                    const qlobalQty = specificItem.length
                    const itemId = specificItem[0].item.id
                    const maxPrice = HELPER.goldFormat(specificItem[0].unit_price)
                    const minPrice = HELPER.goldFormat(specificItem.pop().unit_price)
                    const itemQuality = HELPER.getItemRank(specificItem[0].quality)
                    const setItemQuality = itemQuality ? itemQuality : ''

                    const mediaUrl = `${apiMedia}/${itemId}`
                    const mediaData = await getAucData(mediaUrl)

                    if (mediaData) {
                        ctx.replyWithPhoto(mediaData.data.assets[0].value)
                    }

                    ctx.reply(`${setItemQuality} Общее количество товара - ${qlobalQty} лот${HELPER.plural(qlobalQty, ['', 'а', 'ов'])}`).then(res => {
                        ctx.reply(`Минимальная цена: ${minPrice.gold}🟡  ${minPrice.silver}⚪️  ${minPrice.copper}🟤`)
                        ctx.reply(`Максимальная цена: ${maxPrice.gold}🟡  ${maxPrice.silver}⚪️  ${maxPrice.copper}🟤`)
                    })
                } else {
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
                    } else {
                        ctx.reply(`Не удалось найти предметы по запросу ${userText}`)
                    }
                }
            } catch (e) {
                ctx.reply('Не удалось получить ответ по такому запросу от сервера')
                ctx.reply(e)
            }
        } else if(!hasServerMess) {
            ctx.reply("Нужно указать сервер через команду /setServer")
        }
    });
})

const getAucData = async (url) => {
    try {
        const data = await axios.get(url).catch(() => [])
        return data
    } catch (e) {
        throw e;
    }
}
bot.launch()