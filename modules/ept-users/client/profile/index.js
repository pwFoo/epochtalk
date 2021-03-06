var route = ['$stateProvider', function($stateProvider) {
  $stateProvider.state('profile', {
    // url: '/profiles/{username}',
    parent: 'public-layout',
    reloadOnSearch: false,
    views: {
      'content': {
        controller: [ function() {} ],
        controllerAs: 'ProfileCtrl',
        template: '<profile user="ProfileCtrl.user"></profile>'

      }
    },
    resolve: {
      profileDirective: ['$q', '$ocLazyLoad', function($q, $ocLazyLoad) {
        var deferred = $q.defer();
        require.ensure([], function() {
          require('./../../../modules/ept-users/directives/reset-password.directive.js');
          require('./../../../modules/ept-users/directives/profile.directive.js');
          require('./../../../modules/ept-user-notes/usernotes.directive.js');
          require('./../../../modules/ept-images/image-uploader.directive');
          $ocLazyLoad.load([
            { name: 'ept.directives.resetPassword' },
            { name: 'ept.directives.profile' },
            { name: 'ept.directives.usernotes' },
            { name: 'ept.directives.image-uploader' }
          ]);
          deferred.resolve();
        });
        return deferred.promise;
      }]
    }
  })
  .state('profile.posts', {
    url: '/profiles/{username}?limit&page&desc&threads',
    reloadOnSearch: false,
    views: {
      'posts@profile': {
        controller: 'ProfilePostsCtrl',
        controllerAs: 'ProfilePostsCtrl',
        template: require('./posts.html')
      }
    },
    resolve: {
      $title: ['user', function(user) { return user.username; }],
      loadCtrl: ['$q', '$ocLazyLoad', function($q, $ocLazyLoad) {
        var deferred = $q.defer();
        require.ensure([], function() {
          var ctrl = require('./posts.controller');
          $ocLazyLoad.load({ name: 'ept.profile.postsCtrl' });
          deferred.resolve(ctrl);
        });
        return deferred.promise;
      }],
      user: ['User', '$stateParams', function(User, $stateParams) {
        return User.get({ id: $stateParams.username }).$promise
        .then(function(user) { return user; });
      }],
      pageData: ['Posts', '$stateParams', function(Posts, $stateParams) {

        var threads = $stateParams.threads === "true" || $stateParams.threads === true;

        var params = {
          username: $stateParams.username,
          desc: $stateParams.desc || true,
          limit: Number($stateParams.limit) || 25,
          page: Number($stateParams.page) || 1
        };

        var promise = Posts.pageByUser(params).$promise;
        if (threads) {
          promise = Posts.pageStartedByUser(params).$promise
          .then(function(data) {
            data.threads = true;
            return data;
          });
        }
        return promise;
      }]
    }
  });

  $stateProvider.state('users-posts', {
    url: '/profiles/{username}/posts?limit&page&desc&threads',
    parent: 'public-layout',
    reloadOnSearch: false,
    views: {
      'content': {
        controller: 'ProfilePostsCtrl',
        controllerAs: 'ProfilePostsCtrl',
        template: require('./posts.html')
      }
    },
    resolve: {
      $title: ['$stateParams', function($stateParams) {
        return 'Posts by ' + $stateParams.username;
      }],
      loadCtrl: ['$q', '$ocLazyLoad', function($q, $ocLazyLoad) {
        var deferred = $q.defer();
        require.ensure([], function() {
          var ctrl = require('./posts.controller');
          $ocLazyLoad.load({ name: 'ept.profile.postsCtrl' });
          deferred.resolve(ctrl);
        });
        return deferred.promise;
      }],
      user: [ 'User', '$stateParams', function(User, $stateParams) {
        return User.get({ id: $stateParams.username }).$promise
        .then(function(user) { return user; });
      }],
      pageData: ['Posts', '$stateParams', function(Posts, $stateParams) {

        var threads = $stateParams.threads === "true" || $stateParams.threads === true;

        var params = {
          username: $stateParams.username,
          desc: $stateParams.desc || true,
          limit: Number($stateParams.limit) || 25,
          page: Number($stateParams.page) || 1
        };

        var promise = Posts.pageByUser(params).$promise;
        if (threads) {
          promise = Posts.pageStartedByUser(params).$promise
          .then(function(data) {
            data.threads = true;
            return data;
          });
        }
        return promise;
      }]
    }
  });
}];

module.exports = angular.module('ept.profile', ['ui.router'])
.config(route)
.name;
