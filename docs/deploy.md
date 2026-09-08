# docs/deploy.md

This file explains how to deploy the scaffold in this repository.

Prerequisites
- A Cloudflare account with Workers and Durable Objects enabled.
- Access to enable the Workers Sockets (raw TCP) API for your account. This may be gated depending on your Cloudflare plan.
- wrangler (Cloudflare CLI) installed and logged in: https://developers.cloudflare.com/workers/cli-wrangler/quickstart

Quick steps
1) Edit worker/wrangler.toml
   - Set account_id = "<your-account-id>"
   - If you want to publish directly to your domain, add a route in [triggers] routes and set workers_dev = false

2) Enable the Sockets API for your account
   - Contact Cloudflare support or check your account settings. The Sockets API is required to open outbound TCP connections from a Worker/DO.

3) Publish the Worker
   - From the repo root (where worker/wrangler.toml is), run:
     wrangler publish --env production
   - Or for testing on workers.dev (if workers_dev = true): wrangler publish

4) Configure a route for /bridge on your domain (optional)
   - In Cloudflare dashboard > Workers > Add route: example.com/bridge* -> cloudflare-rdp-gateway-worker
   - Alternatively, use a Pages site and a Pages Functions or Worker route to forward /bridge to the Worker.

5) Host the frontend
   - You can serve frontend/index.html on Cloudflare Pages or GitHub Pages. Set CNAME as needed.
   - The frontend expects the websocket endpoint at the same origin under /bridge. If you host Pages under a different domain, update the frontend URL.

6) RDP client (WASM) or server-side translator
   - The scaffold does NOT include an RDP client. You have two options:
     a) Compile an RDP client to WASM and embed it in frontend/; the WASM client should open a WebSocket to /bridge?host=...&port=3389 and send/receive raw RDP bytes.
     b) Run a server-side translator like Apache Guacamole (guacd) that exposes a websocket endpoint; in that case you may not need the Sockets API and can proxy websockify/guacd via a Worker or Tunnel.

Testing locally
- You can test the Worker with wrangler dev, but the Sockets API may behave differently in the local dev environment. Testing against a real Cloudflare deployment is recommended.

Security
- Do NOT expose raw RDP hosts publicly without authentication and access control.
- Add authentication before allowing a client to bridge to arbitrary hosts, for example by requiring a signed session token.

Limitations & caveats
- Cloudflare enforces resource limits (memory, CPU). The Durable Object should act as a simple byte pipe; avoid heavy CPU work in the DO.
- Some target addresses may be blocked by Cloudflare (internal IP ranges). If your RDP host is private, consider using Cloudflare Tunnel (cloudflared) on the RDP host and connect from the Worker via the Tunnel or expose the Tunnel as a hostname the Worker can reach.

