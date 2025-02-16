// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const cron_check = require('./cron/check.js');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });


// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);

	cron_check(client, ['DISCORD_SERVER_ID', 'DISCORD_SERVER_ID2']);
});

// Log in to Discord with your client's token
client.login(process.env.token);