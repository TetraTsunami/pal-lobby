import fs from 'fs';
import { createServer, IncomingMessage } from 'http';

import express, { NextFunction, Request } from 'express';
import { EAuthTokenPlatformType, LoginSession } from 'steam-session';
import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid';
import WebSocket, { WebSocketServer } from 'ws';

// import { loggedIn as discordLoggedIn } from "./discord";
import { initializeSteam, loggedIn as steamLoggedIn } from "./steam";

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

const sessions = new Map<string, steamLoginSession | monitorSession>();
const loggingMiddleware = (req: Request, _: any, next: NextFunction) => {
  const time = new Date(Date.now()).toLocaleString();
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
    steam: steamLoggedIn,
  }
  res.status(200).json(status);
});

app.get('/api/steamLogin', async (_, res) => {
  const sessionId = uuidv4();
  const steamSession = new LoginSession(EAuthTokenPlatformType.SteamClient);
  steamSession.loginTimeout = 2 * 60 * 1000; // 2 mins
  const startResult = await steamSession.startWithQR();

  const qrData = QRCode.toDataURL(startResult.qrChallengeUrl as string);
  sessions.set(sessionId, { type: "steamLogin", socket: null, loginSession: steamSession });
  res.json({ qrData: await qrData, sessionId });
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
    await initializeSteam(ls.refreshToken);
    fs.writeFileSync('refreshToken.txt', ls.refreshToken);
    wsSend("success", "Authenticated successfully! SteamID = " + ls.steamID);
    ws.close();
    ls.cancelLoginAttempt();
  });
  ls.on('timeout', () => {
    wsSend("err", "Login attempt timed out");
  });
  ls.on('error', (err: any) => {
    wsSend("err", err.message);
  });
}

function monitorWSHandler(ms: monitorSession, ws: WebSocket) {
  const wsSend = (type: string, msg: string) => {
    ws.send(JSON.stringify({ type, msg }));
  }
  // Monitor friends list.
  // Initial message is full list (name, pfp, status)
  // Subsequent messages are updates (name, status)
  
}

export default server;