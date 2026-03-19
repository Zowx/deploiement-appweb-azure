const express = require('express');
const path = require('path');
const compression = require('compression');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 8080;

const BACKEND_HOST = process.env.BACKEND_HOST || 'app-cloudazure-backend-dev.azurewebsites.net';

// Gzip compression
app.use(compression());

// Reverse proxy for /api/* requests to the backend (server-side)
app.use('/api', (req, res) => {
  const options = {
    hostname: BACKEND_HOST,
    port: 443,
    path: `/api${req.url}`,
    method: req.method,
    headers: {
      ...req.headers,
      host: BACKEND_HOST,
    },
  };

  // Remove headers that shouldn't be forwarded
  delete options.headers['connection'];

  const proxyReq = https.request(options, (proxyRes) => {
    // Copy CORS headers
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'access-control-allow-origin': req.headers.origin || '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Backend unavailable' });
  });

  req.pipe(proxyReq, { end: true });
});

// Serve static files from current folder (server.cjs is copied into dist/)
app.use(express.static(__dirname, {
  maxAge: '1y',
  etag: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// SPA fallback - serve index.html for all other routes (Express v5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Proxying /api/* to ${BACKEND_HOST}`);
});
