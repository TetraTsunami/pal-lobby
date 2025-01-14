import { Client, Events, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers, 
  GatewayIntentBits.GuildPresences,
] });

client.login(process.env.DISCORD_TOKEN);

export let loggedIn = false;
const readyClient: Promise<Client<true>> = new Promise((resolve) => {
  client.once(Events.ClientReady, readyClient => {
    console.log(`Discord logged in as ${readyClient.user.tag}`);
    loggedIn = true;
    resolve(readyClient);
  });
});

export default readyClient;