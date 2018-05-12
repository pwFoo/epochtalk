module.exports = [
  {
    name: 'auth.merit.canMerit',
    method: canMerit,
    options: { callback: false }
  }
];

function canMerit(server, auth, postId, toUserId, amount) {
  var userId = '';
  var authenticated = auth.isAuthenticated;
  if (authenticated) { userId = auth.credentials.id; }

  // check base permission
  var allowed = server.authorization.build({
    error: Boom.forbidden('You do not have permissions to send merit'),
    type: 'hasPermission',
    server: server,
    auth: auth,
    permission: 'merit.send.allow'
  });

  // user has permission to see the post they giving merit to
  var read = server.authorization.build({
    error: Boom.unauthorized('You do not have permissions to merit this post'),
    type: 'dbValue',
    method: server.db.posts.getPostsBoardInBoardMapping,
    args: [postId, server.plugins.acls.getUserPriority(auth)]
  });

  // check that the user isn't giving merit to themselves
  var notAuthedUser = function() {
    if (userId === toUserId) {
      var error = Boom.badRequest('You are not allowed to merit your own posts');
      return Promise.reject(error);
    }
    else { return true; }
  };

  // check that the user isn't giving merit to themselves
  var validMeritAmount = function() {
    if (!amount || amount <= 0) {
      var error = Boom.badRequest('Invalid merit amount');
      return Promise.reject(error);
    }
    else { return true; }
  };

  return Promise.all([allowed, read, notAuthedUser, validMeritAmount]);
};