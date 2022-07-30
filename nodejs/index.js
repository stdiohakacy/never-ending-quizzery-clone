require('dotenv').config();
const quizDB = require('./lib/db');
const port = process.env.NODE_PORT || 8000;
const express = require('express');
const app = express();

app.use(express.static('./static'));

app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'must-revalidate, max-age=0'
  });
  next();
});

// route: fetch a question
app.get('/question', async (req, res) => {
  const questions = await quizDB.getQuestion();
  if (questions) 
    res.json(questions);
  else 
    res.status(500).send('service unavailable');
});

// start HTTP server
app.listen(port, () =>
  console.log(`quiz app running on port ${port}`)
);