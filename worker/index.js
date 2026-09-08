// worker/index.js
// Simple authenticated web proxy that rewrites HTML links to route through the proxy.
// WARNING: This is a minimal demo. Running an open proxy is dangerous and can be abused.
// Configure PROXY_TOKEN and (optionally) ALLOWLIST_HOSTS in wrangler.toml or via secrets.

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

function htmlPage() {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Secure Proxy — Chrome-like UI</title>
<style>
  :root{--bg:#f6f7f9;--bar:#fff;--muted:#666}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:var(--bg)}
  header{background:var(--bar);padding:10px 12px;display:flex;gap:8px;align-items:center;box-shadow:0 1px 0 rgba(0,0,0,0.06)}
  input.address{flex:1;padding:8px 10px;border-radius:6px;border:1px solid #ddd}
  button{padding:8px 10px;border-radius:6px;border:1px solid #cfcfcf;background:#fff}
  #frame{width:100%;height:calc(100vh - 64px);border:0}
  #log{position:fixed;right:12px;bottom:12px;background:#111;color:#fff;padding:8px;border-radius:6px;font-size:12px;opacity:0.9}
</style>
</head>
<body>
  <header>
    <button id="back">◀</button>
    <button id="forward">▶</button>
    <input id="address" class="address" placeholder="https://example.com">
    <button id="go">Go</button>
  </header>
  <iframe id="frame" sandbox="allow-forms allow-scripts allow-same-origin"></iframe>
  <div id="log">Proxy ready</div>

<script>
  const token = localStorage.getItem('proxy_token') || '';
  if(!token){
    const t = prompt('Enter proxy token (set in server PROXY_TOKEN):');
    if(t) localStorage.setItem('proxy_token', t);
  }

  const address = document.getElementById('address');
  const go = document.getElementById('go');
  const frame = document.getElementById('frame');
  const log = document.getElementById('log');
  const back = document.getElementById('back');
  const forward = document.getElementById('forward');

  function info(...args){ log.textContent = args.join(' '); }

  function proxyUrl(raw){
    return '/proxy?url=' + encodeURIComponent(raw) + '&token=' + encodeURIComponent(localStorage.getItem('proxy_token')||'');
  }

  go.addEventListener('click', ()=>{
    const url = address.value.trim();
    if(!url) return; info('loading',url); frame.src = proxyUrl(url);
  });

  address.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') go.click(); });

  // simple messaging: when the iframe navigates, update address if the proxy script posts location
  window.addEventListener('message', (e)=>{
    if(e.data && e.data.type === 'location'){
      address.value = e.data.location;
    }
  });

  back.addEventListener('click', ()=>{ frame.contentWindow && frame.contentWindow.history.back(); });
  forward.addEventListener('click', ()=>{ frame.contentWindow && frame.contentWindow.history.forward(); });
</script>
</body>
</html>`;
}

function isHtmlResponse(resp) {
  const ct = resp.headers.get('content-type') || '';
  return ct.includes('text/html');
}

// HTML rewriter to rewrite attributes to go through /proxy
class AttrRewriter {
  constructor(attrName) { this.attrName = attrName }
  element(elem) {
    const val = elem.getAttribute(this.attrName);
    if(!val) return;
    // don't rewrite data: or javascript: or mailto:
    if(/^\s*(javascript:|data:|mailto:|#)/i.test(val)) return;
    try{
      const abs = new URL(val, 'https://example.org'); // base doesn't matter — we'll encode raw
      const proxied = '/proxy?url=' + encodeURIComponent(abs.href);
      elem.setAttribute(this.attrName, proxied);
    }catch(e){
      // fallback: encode as-is
      elem.setAttribute(this.attrName, '/proxy?url=' + encodeURIComponent(val));
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Serve the UI at root
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(htmlPage(), { headers: { 'content-type': 'text/html;charset=UTF-8' } });
    }

    if (url.pathname === '/proxy') {
      return handleProxy(request, env);
    }

    return new Response('Not found', { status: 404 });
  }
};

async function handleProxy(request, env){
  const reqUrl = new URL(request.url);
  const target = reqUrl.searchParams.get('url');
  const token = reqUrl.searchParams.get('token') || getBearerToken(request);

  if (!target) return new Response('missing url parameter', { status: 400 });

  // Basic token auth: require PROXY_TOKEN env or allow if PROXY_TOKEN is empty (not recommended)
  const required = env.PROXY_TOKEN || '';
  if(required && token !== required) return new Response('unauthorized: invalid token', { status: 401 });

  let targetUrl;
  try { targetUrl = new URL(target); }
  catch (e) { return new Response('invalid target url', { status: 400 }); }

  // Optional allowlist
  if (env.ALLOWLIST_HOSTS) {
    const allow = env.ALLOWLIST_HOSTS.split(',').map(s=>s.trim()).filter(Boolean);
    if (allow.length > 0 && !allow.includes(targetUrl.hostname)) {
      return new Response('target not allowed', { status: 403 });
    }
  }

  // Build fetch init: forward method and body
  const init = {
    method: request.method,
    headers: {},
    redirect: 'manual'
  };

  // Copy headers except hop-by-hop and sensitive ones
  for (const [k, v] of request.headers.entries()){
    const lk = k.toLowerCase();
    if (['host','cookie','authorization','proxy-authorization','x-forwarded-for'].includes(lk)) continue;
    init.headers[k] = v;
  }

  // Force a Chrome User-Agent to "look like chrome"
  init.headers['User-Agent'] = CHROME_UA;

  // Attach body if present
  if (request.method !== 'GET' && request.method !== 'HEAD'){
    init.body = request.body;
  }

  // Perform the fetch from Cloudflare's network — the remote server will see Cloudflare IPs
  let resp;
  try{
    resp = await fetch(targetUrl.toString(), init);
  }catch(e){
    return new Response('upstream fetch failed: ' + String(e), { status: 502 });
  }

  // Remove hop-by-hop headers
  const excluded = ['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade'];
  const headers = new Headers();
  for (const [k,v] of resp.headers.entries()){
    if (excluded.includes(k.toLowerCase())) continue;
    headers.set(k, v);
  }

  // If HTML, rewrite links to point back through the proxy
  if (isHtmlResponse(resp)){
    const rewriter = new HTMLRewriter()
      .on('a', new AttrRewriter('href'))
      .on('img', new AttrRewriter('src'))
      .on('script', new AttrRewriter('src'))
      .on('link', new AttrRewriter('href'))
      .on('form', new AttrRewriter('action'));

    // Add a small script to postMessage the current location back to parent UI (so address bar can update)
    const injected = `\n<script>try{window.parent&&window.parent.postMessage({type:'location',location:location.href}, '*')}catch(e){}</script>`;

    // Append injected script to HTML before closing body
    const transformed = rewriter.transform(resp);
    // Unfortunately HTMLRewriter can't append content easily here; a simple replace on the body closing tag would work only for text
    const text = await transformed.text();
    const final = text.replace(/<\/body>/i, injected + '</body>');
    headers.set('content-length', String(new TextEncoder().encode(final).length));
    return new Response(final, { status: resp.status, headers });
  }

  // For non-HTML, stream the response back with same status and headers
  return new Response(resp.body, { status: resp.status, headers });
}

function getBearerToken(request){
  const auth = request.headers.get('Authorization') || '';
  if(auth.startsWith('Bearer ')) return auth.slice(7);
  return '';
}
