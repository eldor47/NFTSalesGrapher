
const { Client, Intents, MessageAttachment, MessageEmbed } = require('discord.js');

const path = require('path')

const {makeChart} = require('./generateChart')

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] }); //create new client

client.once('ready', () => {
    console.log('CLIENT ONLINE')
})

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!summary')) {
        var address = message.content.split(/ (.+)/)[1]
        if(address){
            message.reply('Thinking...')
            makeChart(address).then(fileName => {
                sendImage(message, fileName)
            }).catch(e => {
                message.reply(e.message)
                return
            })
        } else {
            message.reply('Please enter a contract address e.g !summary 0x8a90cab2b38dba80c64b7734e58ee1db38b8992e')
        }
        return
    }
})

const sendImage = (message, fileName) => {
    var newPath = path.join(__dirname, '/charts/' + fileName)
    const file = new MessageAttachment(newPath)

    message.channel.send(
        { embeds: [new MessageEmbed().setTitle(fileName)],
            files: [file]
        })
}

client.login('DISCORDAPIKEY')