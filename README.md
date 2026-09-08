# cloudflare-rdp-gateway
A web-based RDP gateway for Windows Server computers through Cloudflare Workers

This repository provides a scaffold to run a browser → RDP gateway using Cloudflare Pages (frontend) + Cloudflare Workers (Durable Object bridge using the Sockets API). It is a template: you'll need to enable the Sockets API and Durable Objects in your Cloudflare account and provide a WASM/JS RDP client or use a server-side translator (Guacamole).
