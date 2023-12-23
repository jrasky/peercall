import http from 'http';
import https from 'https';
import fs from 'fs';
import mime from 'mime-types';
import WebSocket, { WebSocketServer } from 'ws';

interface Session {
    sessionId: string;
    clients: WebSocket[];
}

const SESSIONS: Map<string, Session> = new Map();

function randomId(length: number): string {
    let id = '';

    function mapCharacter(choice: number): string {
        if (choice < 10) {
            return String.fromCharCode(0x30 + choice);
        } else if (choice < 10 + 26) {
            return String.fromCharCode(0x41 + choice - 10);
        } else {
            return String.fromCharCode(0x61 + choice - 10 - 26);
        }
    }

    for (let i = 0; i < length; i++) {
        const choice = Math.floor(Math.random() * 62);

        id += mapCharacter(choice);
    }

    return id;
}

const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (ws: WebSocket, session: Session, clientId: string) => {
    console.log(`Connection from ${clientId}`);

    ws.on('error', console.error);

    ws.on('message', (data, isBinary) => {
        if (session.clients.length < 2) {
            // No counterpart yet, drop message
            return;
        }

        if (isBinary) {
            // drop binary messages
            return;
        }

        const counterpart = session.clients.find(client => client !== ws)!;
        counterpart.send(data.toString());
    });

    ws.on('close', () => {
        console.log(`Closing session ${session.sessionId}`);

        const counterpart = session.clients.find(client => client !== ws)!;
        if (counterpart) {
            counterpart.close();
        }

        SESSIONS.delete(session.sessionId);
    });
});

const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/streaming.kobold.house/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/streaming.kobold.house/cert.pem'),
    ca: fs.readFileSync('/etc/letsencrypt/live/streaming.kobold.house/fullchain.pem'),
};

const server = https.createServer(options, (req, res) => {
    console.log(`${req.socket.remoteAddress} ${req.method} ${req.url}`);

    if (req.method === 'GET' && req.url! === '/') {
        const sessionId = randomId(10);

        SESSIONS.set(sessionId, {
            sessionId,
            clients: [],
        });

        res.writeHead(303, { 'Location': `/session/${sessionId}` });
        res.end();
    } else if (req.method === 'GET' && req.url!.startsWith('/assets/')) {
        const path = req.url!.substring('/assets/'.length);
        if (path.indexOf('..') > -1) {
            res.writeHead(404);
            res.end();
            return;
        }

        fs.readFile(`assets/${path}`, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end();
                return;
            }

            res.writeHead(200, {
                'Content-Type': mime.lookup(path) || 'application/octet-stream',
            });

            res.end(data);
        });
    } else if (req.method === 'GET' && req.url!.startsWith('/session/')) {
        const sessionId = req.url!.substring('/session/'.length);
        const session = SESSIONS.get(sessionId);
        if (!session) {
            res.writeHead(404);
            res.end();
            return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.readFile('index.html', (_, data) => res.end(data));
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.on('upgrade', (req, socket, head) => {
    console.log(`${req.socket.remoteAddress} ${req.method} ${req.url} Upgrade: ${req.headers.upgrade}`);
    
    if (req.headers.upgrade !== 'websocket') {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
    }

    if (req.url!.startsWith('/session/')) {
        const sessionId = req.url!.substring('/session/'.length);

        const session = SESSIONS.get(sessionId);
        if (!session) {
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
            socket.destroy();
            return;
        }

        if (session.clients.length > 1) {
            // Allow only two clients per session
            socket.write('HTTP 400 Bad Request\r\n\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, ws => {
            session.clients.push(ws);
            wss.emit('connection', ws, session, req.socket.remoteAddress!);
        });
    }
});

server.listen(443, "0.0.0.0");
console.log("Listening on 443");
