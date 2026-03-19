const express = require('express');
const path = require('path');
const compression = require('compression');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 8080;

const BACKEND_HOST = process.env.BACKEND_HOST || 'app-cloudazure-backend-dev.azurewebsites.net';

// Gzip compression (skip SSE responses)
app.use(compression({
  filter: (req, res) => {
    if (req.path === '/api/events') return false;
    return compression.filter(req, res);
  }
}));

// CORS preflight handler
app.options('/api/*', (req, res) => {
  res.set({
    'access-control-allow-origin': req.headers.origin || '*',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
  });
  res.sendStatus(204);
});

// Reverse proxy for /api/* requests to the backend (server-side)
app.use('/api', (req, res) => {
  const isSSE = req.path === '/events';

  const options = {
    hostname: BACKEND_HOST,
    port: 443,
    path: `/api${req.url}`,
    method: req.method,
    headers: {
      ...req.headers,
      host: BACKEND_HOST,
      'x-forwarded-for': req.ip || req.socket.remoteAddress,
      'x-forwarded-proto': req.protocol,
      'x-forwarded-host': req.hostname,
    },
  };

  // Remove hop-by-hop headers that shouldn't be forwarded
  delete options.headers['connection'];
  delete options.headers['transfer-encoding'];

  const proxyReq = https.request(options, (proxyRes) => {
    const responseHeaders = {
      ...proxyRes.headers,
      'access-control-allow-origin': req.headers.origin || '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-credentials': 'true',
    };

    if (isSSE) {
      // SSE-specific: disable buffering and caching
      responseHeaders['cache-control'] = 'no-cache';
      responseHeaders['x-accel-buffering'] = 'no';
      delete responseHeaders['content-length'];
    }

    res.writeHead(proxyRes.statusCode, responseHeaders);

    if (isSSE) {
      // SSE: stream chunks immediately without buffering
      proxyRes.on('data', (chunk) => {
        res.write(chunk);
        if (typeof res.flush === 'function') res.flush();
      });
      proxyRes.on('end', () => res.end());
    } else {
      proxyRes.pipe(res, { end: true });
    }
  });

  // Disable socket timeout for SSE connections
  if (isSSE) {
    proxyReq.setTimeout(0);
    req.setTimeout(0);
    res.setTimeout(0);
  }

  proxyReq.on('error', (err) => {
    console.error(`Proxy error [${req.method} ${req.path}]:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Backend unavailable' });
    }
  });

  req.pipe(proxyReq, { end: !isSSE });
});

// Serve static files (hashed assets get long cache, index.html gets no-cache)
app.use(express.static(__dirname, {
  maxAge: '1y',
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// SPA fallback - serve index.html for all other routes
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Proxying /api/* to ${BACKEND_HOST}`);
});
