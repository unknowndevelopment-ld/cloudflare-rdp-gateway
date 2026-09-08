// worker/index.js
// Authenticated HTML proxy with a Chromium-like UI.
// NOTE: This file includes a placeholder Durable Object class `RDPBridge`
// to preserve compatibility with any existing Durable Objects named RDPBridge.
// The placeholder intentionally returns 410 (disabled).

export class RDPBridge {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    // Placeholder to satisfy existing Durable Object exports; does not implement bridging.
    return new Response('RDPBridge placeholder (disabled)', { status: 410 });
  }
}

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

function htmlPage(){
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chromium-like Secure Proxy</title>
<style>
  :root{--bg:#f1f3f4;--bar:#ffffff;--muted:#6b7280;--accent:#1a73e8;--tab:#e8eaed}
  html,body{height:100%;margin:0;font-family:Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial;color:#202124;background:var(--bg)}
  .window{display:flex;flex-direction:column;height:100vh;border-radius:6px;overflow:hidden}
  .tabs{display:flex;align-items:center;gap:8px;padding:8px;background:transparent}
  .tab{background:var(--tab);padding:8px 12px;border-radius:6px;font-weight:600;color:#202124;box-shadow:inset 0 -1px 0 rgba(0,0,0,0.04)}
  header{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bar);box-shadow:0 1px 0 rgba(0,0,0,0.06)}
  .navbtn{width:36px;height:36px;border-radius:6px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .navbtn:hover{background:#f2f2f2}
  .address-bar{flex:1;display:flex;align-items:center;background:#f6f7f8;border:1px solid #e0e0e0;padding:6px 8px;border-radius:12px}
  .lock{width:16px;height:16px;margin-right:8px;flex:0 0 16px}
  input.address{border:0;background:transparent;outline:0;font-size:14px;width:100%}
  .toolbar-actions{display:flex;gap:8px}
  button.icon{border:0;background:transparent;padding:6px 8px;border-radius:8px;cursor:pointer}
  button.icon:hover{background:#f2f2f2}
  #frame{width:100%;height:calc(100vh - 132px);border:0;background:white}
  .disclaimer{font-size:12px;color:var(--muted);padding:8px 12px;background:#fff;text-align:center}
  .notice{font-size:12px;color:#9e9e9e;margin-left:8px}
  footer{padding:6px 12px;background:#fafafa;border-top:1px solid #eee;text-align:center;font-size:12px;color:var(--muted)}
  /* icons */
  svg{display:block}
</style>
</head>
<body>
  <div class="window" role="application">
    <div class="tabs" aria-hidden="true">
      <div class="tab">New Tab</div>
      <div class="tab" style="opacity:0.6">+ </div>
    </div>
    <header>
      <button id="back" class="navbtn" title="Back" aria-label="Back">◀</button>
      <button id="forward" class="navbtn" title="Forward" aria-label="Forward">▶</button>
      <div class="address-bar" role="search">
        <svg class="lock" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4caf50" d="M12 2C9.79 2 8 3.79 8 6v3H6c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7c0-1.1-.9-2-2-2h-2V6c0-2.21-1.79-4-4-4zM9 9V6c0-1.66 1.34-3 3-3s3 1.34 3 3v3H9z"/></svg>
        <input id="address" class="address" placeholder="https://example.com" aria-label="Address bar">
      </div>
      <div class="toolbar-actions">
        <button id="reload" class="icon" title="Reload">⟳</button>
        <button id="go" class="icon" title="Go">Go</button>
        <div class="notice">Proxy mode</div>
      </div>
    </header>

    <iframe id="frame" sandbox="allow-forms allow-scripts allow-same-origin"></iframe>
    <div class="disclaimer">This proxy UI visually resembles a browser but is not a browser. It is not affiliated with Google Chrome/Chromium. Use responsibly.</div>
    <footer>Powered by Cloudflare Workers — The origin server will see Cloudflare IPs, not your IP.</footer>
  </div>

<script>
  const tokenKey = 'proxy_token';
  if(!localStorage.getItem(tokenKey)){
    const t = prompt('Enter proxy token (obtain from operator):');
    if(t) localStorage.setItem(tokenKey, t);
  }

  const address = document.getElementById('address');
  const go = document.getElementById('go');
  const frame = document.getElementById('frame');
  const back = document.getElementById('back');
  const forward = document.getElementById('forward');
  const reload = document.getElementById('reload');

  function proxyUrl(raw){
    return '/proxy?url=' + encodeURIComponent(raw) + '&token=' + encodeURIComponent(localStorage.getItem(tokenKey)||'');
  }

  async function navigate(raw){
    try{
      const u = raw.trim();
      if(!u) return;
      // Normalize simple entries
      const normalized = u.match(/^https?:\/\//) ? u : 'https://' + u;
      address.value = normalized;
      frame.src = proxyUrl(normalized);
    }catch(e){ console.error(e) }
  }

  go.addEventListener('click', ()=>navigate(address.value));
  address.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') navigate(address.value); });
  back.addEventListener('click', ()=>{ try{ frame.contentWindow.history.back(); }catch(e){} });
  forward.addEventListener('click', ()=>{ try{ frame.contentWindow.history.forward(); }catch(e){} });
  reload.addEventListener('click', ()=>{ try{ frame.contentWindow.location.reload(); }catch(e){ frame.src = frame.src } });

  // Listen for messages from iframe pages to update address bar when possible
  window.addEventListener('message', (e)=>{
    if(e.data && e.data.type === 'location'){
      address.value = e.data.location;
    }
  });

  // Simple history: update address when iframe changes location (best-effort)
  frame.addEventListener('load', ()=>{
    try{
      // Try asking iframe to post its location
      frame.contentWindow.postMessage({type:'request-location'}, '*');
    }catch(e){}
  });
</script>
</body>
</html>`;
}

function isHtmlResponse(resp){
  const ct = resp.headers.get('content-type') || '';
  return ct.includes('text/html');
}

class AttrRewriter {
  constructor(attrName) { this.attrName = attrName }
  element(elem) {
    const val = elem.getAttribute(this.attrName);
    if(!val) return;
    if(/^\s*(javascript:|data:|mailto:|#)/i.test(val)) return;
    try{
      const abs = new URL(val, 'https://example.org');
      const proxied = '/proxy?url=' + encodeURIComponent(abs.href);
      elem.setAttribute(this.attrName, proxied);
    }catch(e){
      elem.setAttribute(this.attrName, '/proxy?url=' + encodeURIComponent(val));
    }
  }
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/index.html'){
      return new Response(htmlPage(), { headers: { 'content-type': 'text/html;charset=UTF-8' } });
    }
    if (url.pathname === '/proxy'){
      return handleProxy(request, env);
    }
    return new Response('Not found', { status: 404 });
  }
};

async function handleProxy(request, env){
  const reqUrl = new URL(request.url);
  const target = reqUrl.searchParams.get('url');
  const token = reqUrl.searchParams.get('token') || getBearerToken(request);

  if(!target) return new Response('missing url parameter', { status: 400 });

  const required = env.PROXY_TOKEN || '';
  if(required && token !== required) return new Response('unauthorized: invalid token', { status: 401 });

  let targetUrl;
  try{ targetUrl = new URL(target); } catch(e){ return new Response('invalid target url', { status: 400 }); }

  if (env.ALLOWLIST_HOSTS){
    const allow = env.ALLOWLIST_HOSTS.split(',').map(s=>s.trim()).filter(Boolean);
    if (allow.length > 0 && !allow.includes(targetUrl.hostname)){
      return new Response('target not allowed', { status: 403 });
    }
  }

  const init = {
    method: request.method,
    headers: {},
    redirect: 'manual'
  };

  for (const [k,v] of request.headers.entries()){
    const lk = k.toLowerCase();
    if (['host','cookie','authorization','proxy-authorization','x-forwarded-for'].includes(lk)) continue;
    init.headers[k] = v;
  }

  init.headers['User-Agent'] = CHROME_UA;

  if (request.method !== 'GET' && request.method !== 'HEAD'){
    init.body = request.body;
  }

  let resp;
  try{ resp = await fetch(targetUrl.toString(), init); } catch(e){ return new Response('upstream fetch failed: ' + String(e), { status: 502 }); }

  const excluded = ['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade'];
  const headers = new Headers();
  for (const [k,v] of resp.headers.entries()){
    if (excluded.includes(k.toLowerCase())) continue;
    headers.set(k, v);
  }

  if (isHtmlResponse(resp)){
    const rewriter = new HTMLRewriter()
      .on('a', new AttrRewriter('href'))
      .on('img', new AttrRewriter('src'))
      .on('script', new AttrRewriter('src'))
      .on('link', new AttrRewriter('href'))
      .on('form', new AttrRewriter('action'));

    const transformed = rewriter.transform(resp);
    const text = await transformed.text();
    const injected = `\n<script>try{window.parent&&window.parent.postMessage({type:'location',location:location.href}, '*')}catch(e){}</script>`;
    const final = text.replace(/<\/body>/i, injected + '</body>');
    headers.set('content-length', String(new TextEncoder().encode(final).length));
    return new Response(final, { status: resp.status, headers });
  }

  return new Response(resp.body, { status: resp.status, headers });
}

function getBearerToken(request){
  const auth = request.headers.get('Authorization') || '';
  if(auth.startsWith('Bearer ')) return auth.slice(7);
  return '';
}
