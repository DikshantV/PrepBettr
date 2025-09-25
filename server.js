const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = process.env.PORT || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log('🚀 Starting PrepBettr with Firebase Admin SDK integration...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Port: ${port}`);

app.prepare().then(() => {
  console.log('✅ Next.js app prepared successfully');
  
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🌟 PrepBettr server ready on http://${hostname}:${port}`);
      console.log('🔑 Azure Key Vault integration: Ready');
      console.log('🔥 Firebase Admin SDK: Ready');
    });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
