import cors from 'cors';
import express from 'express';
import peacock from './peacock.server.js';

let app = express();

// Express middleware to simulate Peacock request structure
/*
app.use((req, res, next) => {
  req.raw = {
    input: `http://example.com${req.url}`,
    body: req, // For compatibility with req.raw.body.pipe(...)
  };
  next();
});
*/

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(peacock);
app.use((req, res) => res.status(404).send('Not Found'));

let port = process.env.PORT || 3000;
let server = app.listen(port, () => {
  console.log(`🦚 Peacock is unfurling its feathers at http://localhost:${port}`);
});
server.on('error', err => err.code === 'EADDRINUSE' && console.error(`❌ Port ${port} is already in use.`));
