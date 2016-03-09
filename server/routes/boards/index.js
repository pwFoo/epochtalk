var path = require('path');
var boards = require(path.normalize(__dirname + '/config'));

module.exports = [
  { method: 'POST', path: '/boards', config: boards.create },
  { method: 'GET', path: '/boards/{id}', config: boards.find },
  { method: 'GET', path: '/boards', config: boards.allCategories },
  { method: 'PUT', path: '/boards', config: boards.update },
  { method: 'POST', path: '/boards/delete', config: boards.delete }
];
