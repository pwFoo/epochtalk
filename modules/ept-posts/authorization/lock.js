var Boom = require('boom');
var Promise = require('bluebird');
var path = require('path');
var common = require(path.normalize(__dirname + '/../common'));

module.exports = function postsLock(server, auth, postId, query) {
  if (query && !query.locked) { return; }

  var userId = auth.credentials.id;
  // check base permission
  var allowed = server.authorization.build({
    error: Boom.forbidden(),
    type: 'hasPermission',
    server: server,
    auth: auth,
    permission: 'posts.lock.allow'
  });

  // read board
  var read = server.authorization.build({
    error: Boom.notFound('Board Not Found'),
    type: 'dbValue',
    method: server.db.posts.getPostsBoardInBoardMapping,
    args: [postId, server.plugins.acls.getUserPriority(auth)]
  });

  // write board
  var write = server.authorization.build({
    error: Boom.forbidden('No Write Access'),
    type: 'dbValue',
    method: server.db.posts.getBoardWriteAccess,
    args: [postId, server.plugins.acls.getUserPriority(auth)]
  });

  // is requester active
  var active = server.authorization.build({
    error: Boom.forbidden('Account Not Active'),
    type: 'isActive',
    server: server,
    userId: userId
  });

  var ignoreOwnership = server.authorization.build({
    // permission based override
    type: 'hasPermission',
    server: server,
    auth: auth,
    permission: 'posts.lock.bypass.lock.admin'
  });

  var notLockedByHigherPriority = function(userId, postId) {
    return server.db.posts.find(postId)
    .then(function(post) {
      var authedUserPriority = server.plugins.acls.getUserPriority(auth);
      // Post was locked by someone else
      if (authedUserPriority && post.metadata && post.metadata.locked_by_id && post.metadata.locked_by_id !== userId) {
        // Person who locked the post has greater priority
        if (post.metadata.locked_by_priority < authedUserPriority) {
          return Promise.reject(Boom.forbidden());
        }
      }
      return Promise.resolve(true);
    })
  }

  // Is user self moderator and do they have priority to hide post
  var selfModCond = [
    {
      // permission based override
      error: Boom.forbidden(),
      type: 'isMod',
      method: server.db.moderators.isModeratorSelfModerated,
      args: [userId, postId],
      permission: 'posts.lock.bypass.lock.selfMod'
    },
    common.hasPriority(server, auth, 'posts.lock.bypass.lock.selfMod', postId),
    notLockedByHigherPriority(userId, postId)
  ];
  var selfMod = server.authorization.stitch(Boom.forbidden(), selfModCond, 'all');

  var priorityModCond = [
    {
      // permission based override
      type: 'hasPermission',
      server: server,
      auth: auth,
      permission: 'posts.lock.bypass.lock.priority'
    },
    common.hasPriority(server, auth, 'posts.lock.bypass.lock.priority', postId),
    notLockedByHigherPriority(userId, postId)
  ];
  var priorityMod = server.authorization.stitch(Boom.forbidden(), priorityModCond, 'all');

  // check self mod permissions
  var permissionsCond = [
    ignoreOwnership,
    common.hasPriority(server, auth, 'posts.lock.allow', postId), // User has permission to lock posts they mod if user has same/lesser priority
    common.hasPriority(server, auth, 'posts.lock.bypass.lock', postId) // User has permission to lock all posts with same/lesser priority
  ];

  var permissions = server.authorization.stitch(Boom.forbidden('Insufficient permissions to perform this action on this user'), permissionsCond, 'any');

  var modCond = [
    ignoreOwnership,
    priorityMod,
    {
      // is board moderator
      type: 'isMod',
      method: server.db.moderators.isModeratorWithPostId,
      args: [userId, postId],
      permission: server.plugins.acls.getACLValue(auth, 'posts.lock.bypass.lock.mod')
    },
    selfMod
  ];
  var mod = server.authorization.stitch(Boom.forbidden(), modCond, 'any');

  return Promise.all([allowed, read, write, active, permissions, mod]);
};
