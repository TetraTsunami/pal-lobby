import fs from 'fs';
import { createServer, IncomingMessage } from 'http';

import express, { NextFunction, Request } from 'express';
import { EAuthTokenPlatformType, LoginSession } from 'steam-session';
import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid';
import WebSocket, { WebSocketServer } from 'ws';

// import { loggedIn as discordLoggedIn } from "./discord";
// import { initializeSteam, loggedIn as steamLoggedIn } from "./steam";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

interface wsSession {
  socket: WebSocket | null;
}
interface steamLoginSession extends wsSession {
  type: "steamLogin";
  loginSession: LoginSession;
}
interface monitorSession extends wsSession {
  type: "monitor";
}

let steamRefreshToken: string | null = null;
let steamAccessToken: string | null = null;
if (fs.existsSync('refreshToken.txt')) {
  steamRefreshToken = fs.readFileSync('refreshToken.txt').toString().trim();
  const steamSession = new LoginSession(EAuthTokenPlatformType.MobileApp);
  steamSession.refreshToken = steamRefreshToken;
  steamSession.refreshAccessToken().then(() => {
    steamAccessToken = steamSession.accessToken;
  });
}

const sessions = new Map<string, steamLoginSession | monitorSession>();
const loggingMiddleware = (req: Request, _: any, next: NextFunction) => {
  const time = new Date(Date.now()).toLocaleString();
  // eslint-disable-next-line no-console
  console.log(`[${time}] ${req.method} ${req.hostname} ${req.path}`);
  next();
}
app.use(loggingMiddleware);
app.use(express.static('public'))
app.get("/api/status", function (_, res) {
  const status = {
    backend: true,
    // discord: discordLoggedIn,
    discord: false,
    steam: steamAccessToken !== null,
  }
  res.status(200).json(status);
});

app.get('/api/steamLogin', async (_, res) => {
  const sessionId = uuidv4();
  const steamSession = new LoginSession(EAuthTokenPlatformType.MobileApp);
  steamSession.loginTimeout = 2 * 60 * 1000; // 2 mins
  const startResult = await steamSession.startWithQR();

  const qrData = QRCode.toDataURL(startResult.qrChallengeUrl as string);
  sessions.set(sessionId, { type: "steamLogin", socket: null, loginSession: steamSession });
  res.json({ qrData: await qrData, sessionId });
});

app.get('/api/monitor', (_, res) => {
  const sessionId = uuidv4();
  sessions.set(sessionId, { type: "monitor", socket: null });
  res.json({ sessionId });
});

wss.on('connection', function (ws, req: IncomingMessage) {
  // url = /ws/:sessionId
  if (!req.url?.startsWith('/ws/')) {
    ws.close();
    return;
  }
  const url = req.url?.split('/');
  if (url === undefined) {
    ws.close();
    return;
  }
  const sessionId = url[2];
  if (!sessions.has(sessionId)) {
    ws.close();
    return;
  }
  const session = sessions.get(sessionId)!;
  session.socket = ws;

  ws.on('error', (err) => {
    console.error(err);
  });
  ws.on('close', () => {
    sessions.delete(sessionId);
  });

  switch (session.type) {
    case "steamLogin":
      steamLoginWSHandler(session, ws);
      break;
    case "monitor":
      monitorWSHandler(session, ws);
      break;
  }
});

function steamLoginWSHandler(ss: steamLoginSession, ws: WebSocket) {
  const wsSend = (type: string, msg: string) => {
    ws.send(JSON.stringify({ type, msg }));
  }
  const ls = ss.loginSession;
  ls.on('remoteInteraction', () => {
    wsSend("msg", "Approve login on your phone");
  });
  ls.on('authenticated', async () => {
    steamRefreshToken = ls.refreshToken;
    fs.writeFileSync('refreshToken.txt', ls.refreshToken);
    wsSend("success", "Authenticated successfully! SteamID = " + ls.steamID);
    ws.close();
    ls.cancelLoginAttempt();
    ls.refreshAccessToken().then(() => {
      steamAccessToken = ls.accessToken;
    });
  });
  ls.on('timeout', () => {
    wsSend("err", "Login attempt timed out");
  });
  ls.on('error', (err: any) => {
    wsSend("err", err.message);
  });
}

const activityCache = new Map<string, lobbyActivity>();
function monitorWSHandler(_ms: monitorSession, ws: WebSocket) {
  const wsSend = (type: string, msg: string) => {
    ws.send(JSON.stringify({ type, msg }));
  }
  wsSend("msg", "Monitoring friends list");
  // Monitor friends list.
  // Initial message is full list (lobbyPal[])
  // Subsequent messages are updates (lobbyPal)
  // lobby activity sent upon request from client
  fetchSteamFriends()
    .then(friends => steamFriendsToPals(friends))
    .then(({ pals, activities }) => {
      activities.forEach(a => activityCache.set(a.id, a));
      wsSend("pals", JSON.stringify(pals));
    });
  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.type === "activity") {
      const activity = activityCache.get(data.id);
      if (activity === undefined) {
        wsSend("err", "Activity not found");
        return;
      }
      wsSend("activity", JSON.stringify(activity));
    }
  });
}
function chunks<T>(array: T[], chunkSize: number): T[][] {
  const result = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    result.push(chunk);
  }

  return result;
}

async function fetchSteamFriends() {
  const friendIDs = await fetch("https://api.steampowered.com/ISteamUserOAuth/GetFriendList/v1/?access_token=" + steamAccessToken).then(res => res.json()).then(data => data.friends.filter((f: any) => f.relationship === "friend").map((f: any) => f.steamid));
  const friendProfiles = await Promise.all(chunks(friendIDs, 30)
    .map(async (chunk) => {
      const profileData = await fetch("https://api.steampowered.com/ISteamUserOAuth/GetUserSummaries/v1/?access_token=" + steamAccessToken + "&steamids=" + chunk.join(",")).then(res => res.json()).then(data => data.players);
      return profileData;
    })
  );
  return friendProfiles.flat();
}

function steamStatusToPalStatus(steamStatus: number): 0 | 1 | 2 {
  switch (steamStatus) {
    case 0: return 0;
    case 1: return 2;
    case 4: return 1;
  }
  return 0;
};

async function steamFriendsToPals(friends: SteamFriendProfile[]): Promise<{ pals: lobbyPal[], activities: lobbyActivity[] }> {
  const pals = friends.map(f => {
    return {
      name: f.personaname,
      avatarURL: f.avatarmedium,
      status: steamStatusToPalStatus(f.personastate),
      activity: f.gameid !== undefined ? `steam:${f.gameid}` : undefined,
    }
  });
  const gameIDs = new Set(friends.filter(f => f.gameid !== undefined).map(f => 
    f.gameid!));
  // fetch game store pages
  const gameData = await Promise.all(Array.from(gameIDs).map(async (gameID) => {
    const storeData = await fetch("https://store.steampowered.com/api/appdetails?appids=" + gameID).then(res => res.json());
    return storeData;
  })); // TODO: could use steamgridDB here for pretty heroes without text
  const activities = gameData.flat()
    .map((data: any) => {
      if (data === null || data.success === false) {
        return null;
      }
      const appid = Object.keys(data)[0];
      const appData = data[appid].data;
      return {
        type: "steam" as const,
        id: appid,
        name: appData.name as string,
        backgroundURL: appData.background_raw as string,
      }
    })
    .filter((a: any) => a !== null) as lobbyActivity[];
  return { pals, activities };
}

interface SteamFriendProfile {
  steamid: string;
  communityvisibilitystate: number;
  profilestate: number;
  personaname: string;
  profileurl: string;
  avatar: string; // avatar urls, small, medium, full
  avatarmedium: string;
  avatarfull: string;
  avatarhash: string;
  lastlogoff: number;
  personastate: number; // Online status! 0 = offline, 1 = online, 4 = away
  primaryclanid: string;
  timecreated: number;
  personastateflags: number;
  gameextrainfo?: string; // Only if in game
  gameid?: string;
}

interface lobbyPal {
  name: string;
  avatarURL: string;
  status: 0 | 1 | 2; // 0 = offline, 1 = idle, 2 = online
  activityID?: string; // steam:id or discord:id
}
interface lobbyActivity {
  type: "steam" | "discord";
  id: string;
  name: string;
  backgroundURL: string;
}

export default server;