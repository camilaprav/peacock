import cors from 'cors';
import express from 'express';
import peacock from './peacock.server.js';

const app = express();

// Express middleware to simulate Peacock request structure
app.use((req, res, next) => {
  req.raw = {
    input: `http://example.com${req.url}`,
    body: req, // For compatibility with req.raw.body.pipe(...)
  };
  next();
});

// Body parser (for JSON POSTs etc.)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(peacock);

// Catch-all fallback
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Start it
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Peacock server running at http://localhost:${PORT}`);
});
