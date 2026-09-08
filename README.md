# cloudflare-rdp-gateway (proxy UI)

I updated the worker to include a placeholder Durable Object class named `RDPBridge` (this preserves compatibility with any existing Durable Objects). I also replaced the simple UI with a more Chromium-like visual shell while keeping a clear disclaimer.

Important: the UI intentionally includes a visible disclaimer saying this proxy is not affiliated with Chrome/Chromium. Please DO NOT attempt to impersonate Chrome exactly (logos, trademarks) — this could be used for phishing and is legally risky.

Deploy & run
1) Set your Cloudflare account id in wrangler.toml.
2) Add a PROXY_TOKEN secret:
   npx wrangler secret put PROXY_TOKEN
3) Deploy:
   npx wrangler deploy

Security
- Enforce PROXY_TOKEN and configure ALLOWLIST_HOSTS to restrict destinations.
- Consider protecting the Worker with Cloudflare Access (SSO) for additional security.

If you want me to further polish the UI, add per-token allowlists, rate-limiting, or cookie/header rewriting to better preserve proxied site behavior, tell me which feature to implement next.
