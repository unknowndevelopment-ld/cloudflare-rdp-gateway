/**
 * worker/index.js
 * Durable Object that bridges a WebSocket from the browser to an outbound TCP socket using the Sockets API.
 *
 * Important: This is a scaffold / example. The Sockets API and Durable Objects must be enabled for your account.
 * Adjust error handling, logging, and authentication for production use.
 */

export class RDPBridge {
  constructor(state, env){
    this.state = state;
    this.env = env;
  }

  async fetch(request){
    // Expecting a WebSocket upgrade from the browser
    const upgradeHeader = request.headers.get('upgrade') || '';
    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('This endpoint only accepts WebSocket connections', { status: 400 });
    }

    const url = new URL(request.url);
    const host = url.searchParams.get('host');
    const port = Number(url.searchParams.get('port') || 3389);
    if (!host) return new Response('missing host parameter', { status: 400 });

    // Create a server/client WebSocket pair. We'll return the client side to the caller.
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    // Start the bridging logic asynchronously so we can immediately return the client.
    this._bridgeWebSocketToTcp(server, host, port).catch(err => {
      try { server.close(1011, String(err)) } catch (e) { /* ignore */ }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async _bridgeWebSocketToTcp(ws, host, port){
    // The Env binding name for the Sockets API is assumed to be SOCKETS. If your account uses a different binding, update references.
    if (!this.env.SOCKETS) {
      ws.send('Server missing Sockets binding (env.SOCKETS).');
      ws.close(1011, 'sockets-binding-missing');
      return;
    }

    let conn;
    try {
      // Connect to the remote RDP host:port. The Sockets API returns a connection with readable & writable streams.
      conn = await this.env.SOCKETS.connect({ hostname: host, port: port });
    } catch (e) {
      ws.send('failed to connect to remote host: ' + String(e));
      ws.close(1011, 'tcp-connect-failed');
      return;
    }

    const tcpReader = conn.readable.getReader();
    const tcpWriter = conn.writable.getWriter();

    // When the browser sends messages over the websocket, write them to the TCP socket.
    ws.addEventListener('message', async (evt) => {
      try {
        const data = evt.data;
        let bytes;
        if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else if (typeof data === 'string') {
          // If sending text, encode as utf-8. RDP is binary, so your client should send ArrayBuffer.
          bytes = new TextEncoder().encode(data);
        } else if (data instanceof Blob) {
          const ab = await data.arrayBuffer();
          bytes = new Uint8Array(ab);
        } else {
          // unknown type
          return;
        }
        await tcpWriter.write(bytes);
      } catch (e) {
        // If write fails, close both sides
        try { ws.close(1011, 'tcp-write-failed') } catch (e) {}
        try { await conn.close() } catch (e) {}
      }
    });

    // Read loop from TCP socket -> send to websocket client
    try {
      for(;;){
        const { value, done } = await tcpReader.read();
        if (done) break;
        if (!value) continue;
        // value is a Uint8Array
        try {
          ws.send(value.buffer);
        } catch (e) {
          break;
        }
      }
    } catch (e) {
      // read error
    }

    // Cleanup
    try { tcpReader.releaseLock(); } catch(e){}
    try { tcpWriter.releaseLock(); } catch(e){}
    try { await conn.close() } catch(e){}
    try { ws.close(1000) } catch(e){}
  }
}

// Top-level fetch: route /bridge requests into a per-session Durable Object
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/bridge')){
      // Determine a session id (client-provided or random)
      const session = url.searchParams.get('session') || crypto.randomUUID();
      const id = env.RDP_BRIDGE.idFromName(session);
      const obj = env.RDP_BRIDGE.get(id);
      return obj.fetch(request);
    }

    return new Response('Cloudflare RDP Gateway: worker running. Use /bridge?host=...&port=... to connect.', { status: 200 });
  }
}
