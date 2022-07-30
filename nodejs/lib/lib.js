module.exports.cleanString = str => str
  .trim()
  .replace(/\s+/g, ' ')
  .replace(/& /g, '&amp; ');