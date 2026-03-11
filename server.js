const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const path = require('path');

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const API_KEY = '10812b7a-fdd3-4905-a1d3-28214a380bf8';
const API_SECRET = '0fzg87ie01';
const REDIRECT_URI = 'https://bullbear-trader-pro-production.up.railway.app/callback';
const PORT = process.env.PORT || 3000;

let ACCESS_TOKEN = null;
let upstoxWS = null;
let clients = new Set();
const marketData = {};

const INSTRUMENTS = [
  'NSE_EQ|INE002A01018','NSE_EQ|INE040A01034','NSE_EQ|INE467B01029',
  'NSE_EQ|INE090A01021','NSE_EQ|INE009A01021','NSE_EQ|INE062A01020',
  'NSE_EQ|INE397D01024','NSE_EQ|INE860A01027','NSE_EQ|INE237A01028',
  'NSE_EQ|INE075A01022','NSE_EQ|INE238A01034','NSE_EQ|INE296A01024',
  'NSE_EQ|INE423A01024','NSE_EQ|INE585B01010','NSE_EQ|INE044A01036',
  'NSE_EQ|INE018A01030','NSE_EQ|INE101A01026','NSE_EQ|INE280A01028',
  'NSE_EQ|INE047A01021','NSE_EQ|INE918I01026','NSE_EQ|INE733E01010',
  'NSE_EQ|INE752E01010','NSE_EQ|INE213A01029','NSE_EQ|INE522F01014',
  'NSE_EQ|INE019A01038','NSE_EQ|INE038A01020','NSE_EQ|INE081A01012',
  'NSE_EQ|INE155A01022','NSE_EQ|INE917I01010','NSE_EQ|INE030A01027',
  'NSE_EQ|INE239A01016','NSE_EQ|INE669C01036','NSE_EQ|INE481G01011',
  'NSE_EQ|INE089A01023','NSE_EQ|INE361B01024','NSE_EQ|INE059A01026',
  'NSE_EQ|INE437A01024','NSE_EQ|INE066A01021','NSE_EQ|INE029A01011',
  'NSE_EQ|INE795G01014','NSE_EQ|INE123W01016','NSE_EQ|INE095A01012',
  'NSE_EQ|INE742F01042','NSE_EQ|INE192A01025','NSE_EQ|INE628A01036',
  'NSE_EQ|INE154A01025','NSE_EQ|INE263A01024','NSE_EQ|INE158A01026',
  'NSE_EQ|INE021A01026','NSE_EQ|INE075I01017'
];

const SYMBOL_MAP = {
  'NSE_EQ|INE002A01018':'RELIANCE','NSE_EQ|INE040A01034':'HDFCBANK',
  'NSE_EQ|INE467B01029':'TCS','NSE_EQ|INE090A01021':'ICICIBANK',
  'NSE_EQ|INE009A01021':'INFY','NSE_EQ|INE062A01020':'SBIN',
  'NSE_EQ|INE397D01024':'BHARTIARTL','NSE_EQ|INE860A01027':'HCLTECH',
  'NSE_EQ|INE237A01028':'KOTAKBANK','NSE_EQ|INE075A01022':'WIPRO',
  'NSE_EQ|INE238A01034':'AXISBANK','NSE_EQ|INE296A01024':'BAJFINANCE',
  'NSE_EQ|INE423A01024':'ADANIENT','NSE_EQ|INE585B01010':'MARUTI',
  'NSE_EQ|INE044A01036':'SUNPHARMA','NSE_EQ|INE018A01030':'LT',
  'NSE_EQ|INE101A01026':'M&M','NSE_EQ|INE280A01028':'TITAN',
  'NSE_EQ|INE047A01021':'GRASIM','NSE_EQ|INE918I01026':'BAJAJFINSV',
  'NSE_EQ|INE733E01010':'NTPC','NSE_EQ|INE752E01010':'POWERGRID',
  'NSE_EQ|INE213A01029':'ONGC','NSE_EQ|INE522F01014':'COALINDIA',
  'NSE_EQ|INE019A01038':'JSWSTEEL','NSE_EQ|INE038A01020':'HINDALCO',
  'NSE_EQ|INE081A01012':'TATASTEEL','NSE_EQ|INE155A01022':'TATAMOTORS',
  'NSE_EQ|INE917I01010':'BAJAJ-AUTO','NSE_EQ|INE030A01027':'HINDUNILVR',
  'NSE_EQ|INE239A01016':'NESTLEIND','NSE_EQ|INE669C01036':'TECHM',
  'NSE_EQ|INE481G01011':'ULTRACEMCO','NSE_EQ|INE089A01023':'DRREDDY',
  'NSE_EQ|INE361B01024':'DIVISLAB','NSE_EQ|INE059A01026':'CIPLA',
  'NSE_EQ|INE437A01024':'APOLLOHOSP','NSE_EQ|INE066A01021':'EICHERMOT',
  'NSE_EQ|INE029A01011':'BPCL','NSE_EQ|INE795G01014':'HDFCLIFE',
  'NSE_EQ|INE123W01016':'SBILIFE','NSE_EQ|INE095A01012':'INDUSINDBK',
  'NSE_EQ|INE742F01042':'ADANIPORTS','NSE_EQ|INE192A01025':'TATACONSUM',
  'NSE_EQ|INE628A01036':'UPL','NSE_EQ|INE154A01025':'ITC',
  'NSE_EQ|INE263A01024':'BEL','NSE_EQ|INE158A01026':'HEROMOTOCO',
  'NSE_EQ|INE021A01026':'ASIANPAINT','NSE_EQ|INE075I01017':'INDIGO'
};

// ── LOGIN PAGE ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (ACCESS_TOKEN) {
    res.sendFile(path.join(__dirname, 'BullBearTrader.html'));
  } else {
    const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    res.send(`<!DOCTYPE html><html>
    <head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{background:#0A0A0F;color:#F0F0F0;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;box-sizing:border-box;}
      h1{color:#FFB300;font-size:24px;letter-spacing:2px;text-align:center;}
      p{color:#888;margin:10px 0 30px;text-align:center;}
      a{background:#7B2FBE;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;text-align:center;}
    </style></head>
    <body>
      <h1>📊 BULLBEAR TRADER</h1>
      <p>Login with Upstox to start live data</p>
      <a href="${loginUrl}">🔐 LOGIN WITH UPSTOX</a>
      <script>setInterval(()=>fetch('/check-token').then(r=>r.json()).then(d=>{if(d.ready)location.reload();}),3000);</script>
    </body></html>`);
  }
});

// ── CALLBACK ──────────────────────────────────────────────────────────────────
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('No code received');
  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', API_KEY);
    params.append('client_secret', API_SECRET);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('grant_type', 'authorization_code');
    const response = await axios.post(
      'https://api.upstox.com/v2/login/authorization/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } }
    );
    ACCESS_TOKEN = response.data.access_token;
    console.log('✅ LOGIN SUCCESS!');
    startMarketStream();
    res.redirect('/');
  } catch (err) {
    console.error('Token error:', JSON.stringify(err.response?.data || err.message));
    res.send('Login failed: ' + JSON.stringify(err.response?.data || err.message) + '<br><a href="/">Try again</a>');
  }
});

app.get('/check-token', (req, res) => res.json({ ready: !!ACCESS_TOKEN }));
app.get('/market-data', (req, res) => res.json(marketData));
app.get('/logout', (req, res) => { ACCESS_TOKEN = null; res.redirect('/'); });

// ── WEBSOCKET ─────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  // Accept token from query param (for GitHub Pages clients)
  const url = new URL(req.url, 'http://localhost');
  const clientToken = url.searchParams.get('token');
  if (clientToken && !ACCESS_TOKEN) {
    ACCESS_TOKEN = clientToken;
    console.log('✅ Token received from client!');
    startMarketStream();
  }
  clients.add(ws);
  if (Object.keys(marketData).length > 0) {
    ws.send(JSON.stringify({ type: 'market_data', data: marketData }));
  }
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    try { if (ws.readyState === WebSocket.OPEN) ws.send(msg); } catch(e) {}
  });
}

// ── UPSTOX STREAM ─────────────────────────────────────────────────────────────
function startMarketStream() {
  if (!ACCESS_TOKEN) return;
  console.log('📡 Connecting to Upstox market feed...');
  try {
    upstoxWS = new WebSocket('wss://api.upstox.com/v2/feed/market-data-feed', {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    upstoxWS.on('open', () => {
      console.log('✅ Upstox feed connected!');
      upstoxWS.send(JSON.stringify({
        guid: 'bb-' + Date.now(),
        method: 'sub',
        data: { mode: 'full', instrumentKeys: INSTRUMENTS }
      }));
    });
    upstoxWS.on('message', (raw) => {
      try {
        const data = JSON.parse(raw);
        if (data.feeds) {
          Object.entries(data.feeds).forEach(([key, feed]) => {
            const sym = SYMBOL_MAP[key];
            if (!sym) return;
            const d = feed.ff?.marketFF || feed.ff?.indexFF;
            if (!d) return;
            const ltpc = d.ltpc || {};
            const ohlc = d.marketOHLC?.ohlc?.find(o => o.interval === '1d') || d.marketOHLC?.['1d'] || {};
            const bids = d.marketDepth?.bid || [];
            const asks = d.marketDepth?.ask || [];
            const totalBid = bids.reduce((a, b) => a + (b.quantity || 0), 0);
            const totalAsk = asks.reduce((a, b) => a + (b.quantity || 0), 0);
            const diff = totalBid - totalAsk;
            const diffPct = totalBid + totalAsk > 0 ? ((diff / (totalBid + totalAsk)) * 100).toFixed(1) : '0.0';
            const ltp = ltpc.ltp || ltpc.cp || 0;
            const cp = ltpc.cp || 0;
            const existing = marketData[sym] || {};
            marketData[sym] = {
              sym,
              price: ltp || existing.price || 0,
              chg: cp > 0 ? (((ltp - cp) / cp) * 100).toFixed(2) : (existing.chg || '0.00'),
              high: ohlc.high || existing.high || 0,
              low: ohlc.low || existing.low || 0,
              pclose: cp || existing.pclose || 0,
              bids: bids.length > 0 ? bids.slice(0,5).map(b=>({price:b.price,qty:b.quantity,orders:b.orders})) : (existing.bids || []),
              asks: asks.length > 0 ? asks.slice(0,5).map(a=>({price:a.price,qty:a.quantity,orders:a.orders})) : (existing.asks || []),
              totalBid: totalBid || existing.totalBid || 0,
              totalAsk: totalAsk || existing.totalAsk || 0,
              diff, diffPct, ts: Date.now()
            };
          });
          broadcast({ type: 'market_data', data: marketData });
        }
      } catch(e) {}
    });
    upstoxWS.on('error', (e) => { console.error('Feed error:', e.message); setTimeout(startMarketStream, 5000); });
    upstoxWS.on('close', () => { console.log('Feed closed, reconnecting...'); setTimeout(startMarketStream, 5000); });
  } catch(e) {
    console.error('Stream error:', e.message);
    setTimeout(startMarketStream, 5000);
  }
}

// ── START ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✅ BullBear Trader running on port ${PORT}`);
  console.log(`🔐 Login at: https://bullbear-trader-pro-production.up.railway.app`);
});

// ── LIVE INDEX DATA ───────────────────────────────────────────────────────────
app.get('/index-data', async (req, res) => {
  try {
    const response = await axios.get('https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_INDEX%7CNifty+50%2CNSE_INDEX%7CNifty+Bank%2CBSE_INDEX%7CSENSEX%2CNSE_INDEX%7CIndia+VIX', {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, Accept: 'application/json' }
    });
    const feeds = response.data.data;
    const result = [
      { n: 'NIFTY 50',   v: feeds['NSE_INDEX|Nifty 50']?.last_price   || 24028, c: feeds['NSE_INDEX|Nifty 50']?.net_change_percentage?.toFixed(2)   || '-1.73' },
      { n: 'BANK NIFTY', v: feeds['NSE_INDEX|Nifty Bank']?.last_price  || 56019, c: feeds['NSE_INDEX|Nifty Bank']?.net_change_percentage?.toFixed(2)  || '-3.05' },
      { n: 'SENSEX',     v: feeds['BSE_INDEX|SENSEX']?.last_price       || 77566, c: feeds['BSE_INDEX|SENSEX']?.net_change_percentage?.toFixed(2)       || '-1.71' },
      { n: 'VIX',        v: feeds['NSE_INDEX|India VIX']?.last_price    || 25.50, c: feeds['NSE_INDEX|India VIX']?.net_change_percentage?.toFixed(2)    || '-13.53' },
    ];
    res.json(result);
  } catch(e) {
    res.json([
      { n: 'NIFTY 50',   v: 24028, c: '-1.73' },
      { n: 'BANK NIFTY', v: 56019, c: '-3.05' },
      { n: 'SENSEX',     v: 77566, c: '-1.71' },
      { n: 'VIX',        v: 25.50, c: '-13.53' },
    ]);
  }
});

// ── CRASH PREVENTION ──────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
