require('dotenv').load();
var path = require('path');
var Hapi = require('hapi');
var Hoek = require('hoek');
var Good = require('good');
var Inert = require('inert');
var Vision = require('vision');
var GoodFile = require('good-file');
var GoodConsole = require('good-console');
var db = require(path.normalize(__dirname + '/../db'));
var redis = require(path.normalize(__dirname + '/../redis'));
var setup = require(path.normalize(__dirname + '/../setup'));
var jwt = require(path.normalize(__dirname + '/plugins/jwt'));
var config = require(path.normalize(__dirname + '/../config'));
var acls = require(path.normalize(__dirname + '/plugins/acls'));
var imageStore = require(path.normalize(__dirname + '/images'));
var limiter = require(path.normalize(__dirname + '/plugins/limiter'));
var blacklist = require(path.normalize(__dirname + '/plugins/blacklist'));
var sanitizer = require(path.normalize(__dirname + '/plugins/sanitizer'));
var serverOptions = require(path.normalize(__dirname + '/server-options'));
var AuthValidate = require(path.normalize(__dirname + '/plugins/jwt/validate'));
var authorization = require(path.normalize(__dirname + '/plugins/authorization'));

var server;

// setup configration file and sync with DB
setup()

// TODO: load modules

// create server instance and add dbs
.then(function() {
  // create server object
  server = new Hapi.Server();
  server.connection(serverOptions);

  // DB decoration
  server.decorate('request', 'db', db);
  server.decorate('server', 'db', db);
  server.decorate('request', 'redis', redis);
  server.decorate('server', 'redis', redis);

  // imageStore decoration
  var is = imageStore();
  server.decorate('request', 'images', is);
  server.decorate('server', 'images', is);
})
// server logging
.then(function() {
  // server logging only registered if config enabled
  if (config.logEnabled) {
    var configWithPath = function(path) {
      return { path: path, extension: 'log', rotate: 'daily', format: 'YYYY-MM-DD-X', prefix:'epochtalk' };
    };
    var options = {
      reporters: [
        {
          reporter: GoodConsole,
          events: { log: '*', response: '*', error: '*' }
        },
        {
          reporter: GoodFile,
          events: { ops: '*' },
          config: configWithPath(path.normalize(__dirname +  '/../logs/server/operations'))
        },
        {
          reporter: GoodFile,
          events: { error: '*' },
          config: configWithPath(path.normalize(__dirname + '/../logs/server/errors'))
        },
        {
          reporter: GoodFile,
          events: { response: '*' },
          config: configWithPath(path.normalize(__dirname + '/../logs/server/requests'))
        },
        {
          reporter: GoodFile,
          events: { log: '*' },
          config: configWithPath(path.normalize(__dirname + '/../logs/server/logs'))
        }
      ]
    };
    return server.register({ register: Good, options: options});
  }
})
// sanitizer
.then(function() { return server.register({ register: sanitizer }); })
// common methods
.then(function() {
  // TODO: move to top after posts and threads modularization
  var common = require(path.normalize(__dirname + '/plugins/common'));
  return server.register({ register: common });
})
// authorization methods
.then(function() { return server.register({ register: authorization }); })
// auth via jwt
.then(function() {
  var authOptions = { redis: redis };
  return server.register({ register: jwt, options: authOptions })
  .then(function() {
    var strategyOptions = {
      key: config.privateKey,
      validateFunc: AuthValidate
    };
    server.auth.strategy('jwt', 'jwt', strategyOptions);
  });
})
// vision templating
.then(function() {
  return server.register(Vision)
  .then(function() {
    // render views
    server.views({
      engines: { html: require('handlebars') },
      path: path.normalize(__dirname + '/../') + 'public'
    });
  });
})
// inert static file serving
.then(function() { return server.register(Inert); })
// route acls
.then(function() {
  var aclOptions = { db: db, config: config };
  return server.register({register: acls, options: aclOptions });
})
// blacklist
.then(function() {
  var blacklistOptions = { db: db };
  return server.register({ register: blacklist, options: blacklistOptions });
})
// rate limiter
.then(function() {
  var rlOptions = Hoek.clone(config.rateLimiting);
  rlOptions.redis = redis;
  return server.register({ register: limiter, options: rlOptions });
})
.then(function() {
  // server routes
  var routes = require(path.normalize(__dirname + '/routes'));
  server.route(routes.endpoints());

  // start server
  server.start(function () {
    var configClone = Hoek.clone(config);
    configClone.privateKey = configClone.privateKey.replace(/./g, '*');
    configClone.emailer.pass = configClone.emailer.pass.replace(/./g, '*');
    configClone.images.s3.accessKey = configClone.images.s3.accessKey.replace(/./g, '*');
    configClone.images.s3.secretKey = configClone.images.s3.secretKey.replace(/./g, '*');
    server.log('debug', 'config: ' + JSON.stringify(configClone, undefined, 2));
    server.log('info', 'Epochtalk Frontend server started @' + server.info.uri);
  });
});
