const mongo = require('mongodb');
const fetch = require('node-fetch');
const lib = require('./lib');

const maxQuestions = 300;
const maxApiFetch = 50;
const maxApiCalls = 10;
const mongoUrl = `mongodb://${ process.env.MONGO_USERNAME }:${ process.env.MONGO_PASSWORD }@${ process.env.MONGO_HOST }:${ process.env.MONGO_PORT }/`;

const client = new mongo.MongoClient(
  mongoUrl,
  { useNewUrlParser: true, useUnifiedTopology: true }
);

let db, quiz;

(async () => {
  try {
    await client.connect();
    db = client.db( process.env.MONGO_DB );
    quiz = db.collection('quiz');

    const initialDb = await init();
    if (!initialDb) {
      throw 'no questions in database';
    }
  }
  catch (err) {
    console.log('database error', err);
  }
})();

async function init() {
  let questionCount = await quiz.countDocuments();
  if (questionCount >= maxQuestions) return questionCount;
  console.log('initializing quiz database...');

  // create indexes
  if (!questionCount) {
    await quiz.createIndexes([
      { key: { category: 1 }},
      { key: { question: 1 } },
      { key: { used: 1 } }
    ]);
  }
    const batch = quiz.initializeUnorderedBulkOp();
    const maxRequest = Math.min(maxApiFetch, maxQuestions - questionCount);
    const quizApi = `https://opentdb.com/api.php?type=multiple&amount=${ maxRequest }`;

  (await Promise.allSettled(
    Array(Math.min(maxApiCalls, Math.ceil((maxQuestions - questionCount) / maxRequest)))
      .fill(quizApi)
      .map((u, i) => fetch(`${u}#${i}`))
    )
    .then(response => Promise.allSettled(response.map(res => res.value && res.value.json())))
    .then(json => json.map(j => j && j.value && j.value.results || [])))
    .flat()
    .forEach(q => {
      let correct = lib.cleanString(q.correct_answer);
      let newQuestion = {
        category: lib.cleanString(q.category),
        question: lib.cleanString(q.question),
        answers:  q.incorrect_answers.map(i => lib.cleanString(i)).concat(correct).sort()
      };

      newQuestion.correct = newQuestion.answers.indexOf(correct);

      batch
        .find({ question: q.question })
        .upsert()
        .update({ $set: newQuestion });
    });

  // update database
  const dbUpdate = await batch.execute();
  const qAdded = dbUpdate.result.nUpserted;
  questionCount += qAdded;

  console.log(`${ qAdded } questions added`);
  console.log(`${ questionCount } questions available`);

  return questionCount;
}

// get next question
module.exports.getQuestion = async () => {
  const nextQuestion = await quiz.findOneAndUpdate(
      {},
      { $inc: { used: 1 }},
      {
        sort: { used: 1 },
        projection: { _id: 0, category: 1, question: 1, answers: 1, correct: 1 }
      }
    );
  return (nextQuestion && nextQuestion.ok && nextQuestion.value) || null;
};