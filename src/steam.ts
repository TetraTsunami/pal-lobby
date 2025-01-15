import SteamUser from 'steam-user';
import fs from 'fs';

const client = new SteamUser();

export let loggedIn = false;

export const readyClient: Promise<SteamUser> = new Promise((resolve) => {
  client.on('loggedOn', () => {
    console.log('Logged into Steam as ' + client.steamID?.getSteamID64());
    loggedIn = true;
    resolve(client);
  });
});

export async function initializeSteam(refreshToken: string) {
  if (!loggedIn) {
    client.logOn({ refreshToken });
  }
  return readyClient;
}

if (fs.existsSync('refreshToken.txt')) {
  client.logOn({
    refreshToken: fs.readFileSync('refreshToken.txt').toString().trim()
  });
}

client.on('friendsList', function() {
  const friends = Object.entries(client.myFriends)
    .filter(([_, relation]) => relation === SteamUser.EFriendRelationship.Friend)
    .map(([steamID]) => steamID);
  // client.getPersonas(friends, (err, personas) => {
  //   if (err) {
  //     console.error(err);
  //     return;
  //   }
  //   console.log(personas);
  // });
});