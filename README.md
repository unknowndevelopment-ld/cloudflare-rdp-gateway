# cloudflare-rdp-gateway (rewritten as a secure proxy)

This repository was rewritten to provide a minimal authenticated web proxy that routes requests through Cloudflare Workers so the origin sees Cloudflare IPs instead of the client's IP.

Important security notes
- This project implements a simple proxy. Running an open proxy is dangerous and will likely be abused. By default the proxy requires an authentication token (PROXY_TOKEN) to be set in your Worker environment.
- Configure ALLOWLIST_HOSTS to limit which hostnames may be proxied.
- This implementation rewrites HTML links to route through the proxy but is NOT a perfect browser — scripts, inline resource URLs, CSP, service workers, and complex web features may break.
- You are responsible for complying with laws and the terms of service of sites you access through this proxy.

Quick start
1) Edit wrangler.toml and set account_id to your Cloudflare account id.
2) Set PROXY_TOKEN as a secret in your Cloudflare Workers environment:
   npx wrangler secret put PROXY_TOKEN
   (enter a strong token)
3) (Optional) Set ALLOWLIST_HOSTS in wrangler.toml or as a variable to restrict proxied hostnames.
4) Publish with:
   npx wrangler deploy
5) Open the worker in your browser (workers_dev url from the deploy output). The UI provides an address bar — enter an https:// URL and click Go.

Limitations
- Does not support websockets, HTTP/2 push, or very large streaming uploads reliably.
- HTML rewriting is simplistic and may not capture every resource URL. Some sites will not work correctly.

Security recommendations
- Keep PROXY_TOKEN secret and rotate it regularly.
- Put the Worker behind Cloudflare Access or other auth layers for additional control.
- Use an allowlist of permitted hosts.
