var Boom = require('boom');
var Promise = require('bluebird');

module.exports = function (server, auth, slug) {
  // check base permission
  var allowed = server.authorization.build({
    error: Boom.forbidden(),
    type: 'hasPermission',
    server: server,
    auth: auth,
    permission: 'threads.byBoard.allow'
  });

  // read board
  var read = server.authorization.build({
    error: Boom.notFound('Board Not Found'),
    type: 'dbValue',
    method: server.db.boards.getBoardInBoardMapping,
    args: [null, server.plugins.acls.getUserPriority(auth), slug]
  });

  return Promise.all([allowed, read])
  .then(function() { return true; })
  .catch(function() { return false; });
};
