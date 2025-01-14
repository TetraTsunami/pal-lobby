import SteamUser from 'steam-user';
import type SteamID from 'steamid';
import fs from 'fs';

const client = new SteamUser();

// client.on('loggedOn', function(details) {
// 	console.log('Logged into Steam as ' + client.steamID.getSteam3RenderedID());
// });

// client.on('error', function(e) {
// 	console.log("Steam logon error", e);
// });

// client.on('friendsList', function() {
//   console.log("Friends list", client.myFriends);
// });

export let loggedIn = false;

const readyClient: Promise<SteamUser> = new Promise((resolve) => {
  client.on('loggedOn', () => {
    console.log('Logged into Steam as ' + (client.steamID as SteamID).getSteam3RenderedID());
    loggedIn = true;
    resolve(client);
  });
});

export async function initializeSteam(refreshToken?: string) {
  if (refreshToken) {
    client.logOn({ refreshToken });
  } else if (fs.existsSync('refreshToken.txt')) {
    client.logOn({
      refreshToken: fs.readFileSync('refreshToken.txt').toString().trim()
    });
  }
  return readyClient;
}