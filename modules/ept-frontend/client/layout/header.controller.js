var ctrl = ['$scope', '$window', '$location', '$timeout', '$state', '$stateParams', 'Auth', 'GoogleAuth', 'Session', 'BreadcrumbSvc', 'Alert', 'ThemeSVC', 'NotificationSvc', 'BanSvc', 'PreferencesSvc',
  function($scope, $window, $location, $timeout, $state, $stateParams, Auth, GoogleAuth, Session, BreadcrumbSvc, Alert, ThemeSVC, NotificationSvc, BanSvc, PreferencesSvc) {
    var ctrl = this;
    this.currentUser = Session.user;
    this.hasPermission = Session.hasPermission;
    this.previewActive = ThemeSVC.previewActive();
    this.loggedIn = Session.isAuthenticated;
    this.breadcrumbs = BreadcrumbSvc.crumbs;
    this.isBanned = BanSvc.isBanned();
    this.hasGoogleCredentials = $window.forumData.google_client_id && $window.forumData.google_api_key && $window.forumData.google_app_domain;
    // Update preview mode on change
    $scope.$watch(function() { return BanSvc.isBanned(); }, function(val) {
      ctrl.isBanned = val;
    });

    // Update preview mode on change
    $scope.$watch(function() { return ThemeSVC.previewActive(); }, function(val) {
      ctrl.previewActive = val;
    });

    this.cancelPreview = function() {
      ThemeSVC.toggleCSS(false);
      $state.go('admin-settings.theme', { preview: undefined }, { reload: true });
    };

    this.savePreview = function() {
      ThemeSVC.saveTheme();
    };

    this.continueEditing = function() {
      $state.go('admin-settings.theme', { preview: true }, { reload: false });
    };

    this.checkAdminRoute = function(route) {
      var pathArr = $location.path().split('/');
      pathArr.shift();
      if (pathArr.length < 2) { return false; }
      return pathArr[0].toLowerCase() === 'admin' && pathArr[1].toLowerCase() === route;
    };

    // Patrol
    this.isPatroller = function() {
      var patrol = false;
      if (!ctrl.loggedIn()) { return patrol; }
      var viewPatroller = PreferencesSvc.preferences.patroller_view;
      if (viewPatroller) { patrol = true; }
      else {
        ctrl.currentUser.roles.map(function(role) {
          if (role === 'patroller') { patrol = true; }
        });
      }
      return patrol;
    };

    // invitations
    this.canInvite = function() {
      var isAuthed = Session.isAuthenticated();
      var hasPermission = Session.hasPermission('invitations.invite');
      if (isAuthed && hasPermission) { return true; }
      else { return false; }
    };

    // Notifications
    this.notificationMessages = NotificationSvc.getMessages;
    this.notificationMentions = NotificationSvc.getMentions;
    this.dismissNotifications = NotificationSvc.dismiss;

    // Search
    this.searchTerms = null;
    this.searchExpanded = false;
    this.focusSearch = false;
    this.searchForum = function() {
      ctrl.collapseMobileKeyboard();
      ctrl.toggleFocusSearch();
      $state.go('search-posts', { search: ctrl.searchTerms }, { reload: false });
      ctrl.searchTerms = null;
    };

    this.toggleFocusSearch = function() {
      ctrl.focusSearch = !ctrl.focusSearch;
      $timeout(function() {
        ctrl.searchExpanded = ctrl.focusSearch;
      }, 500);
    };

    // Login/LogOut
    this.user = {};
    this.showLogin = false;
    this.clearLoginFields = function() {
      $timeout(function() { ctrl.user = {}; }, 500);
    };

    this.collapseMobileKeyboard = function() { document.activeElement.blur(); };

    this.login = function() {
      if (ctrl.user.username.length === 0 || ctrl.user.password.length === 0) { return; }

      Auth.login(ctrl.user)
      .then(function() {
        ctrl.collapseMobileKeyboard();
        ctrl.showLogin = false;
        ctrl.clearLoginFields();
        if ($state.next) {
          $state.go($state.next, $state.nextParams, { reload: true });
          $state.next = undefined;
          $state.nextParams = undefined; // clear out next state info after redirect
        }
        else { $state.go($state.current, $stateParams, { reload: true }); }
      })
      .catch(function(err) {
        if (err.data && err.data.message) { Alert.error(err.data.message); }
        else { Alert.error('Login Failed'); }
      });
    };

    this.logout = function() {
      Auth.logout()
      .then(function() {
        if (ctrl.hasGoogleCredentials && GoogleAuth.isAuthenticated()) {
          GoogleAuth.signOut();
        }
      });
    };

    this.signInWithGoogle = function(username, prompt) {
      GoogleAuth.signIn(username, prompt)
      .then(function(data) {
        if (data && data.has_account === false) {
          ctrl.showRegister = false;
          ctrl.clearRegisterFields();
          ctrl.showLogin = false;
          ctrl.clearLoginFields();
          ctrl.collapseMobileKeyboard();
          ctrl.showGoogleUsername = true;
        }
        else {
          ctrl.showRegister = false;
          ctrl.clearRegisterFields();
          ctrl.showLogin = false;
          ctrl.clearLoginFields();
          ctrl.collapseMobileKeyboard();
          ctrl.showGoogleUsername = false;
          if ($state.next) {
            $state.go($state.next, $state.nextParams, { reload: true });
            $state.next = undefined;
            $state.nextParams = undefined; //clear out next state info after redirect
          }
          else { $state.go($state.current, $stateParams, { reload: true }); }
        }
      })
      .catch(function(err) {
        if (err.error === 'idpiframe_initialization_failed') {
          Alert.error(err.details + ' You must allow cookies from accounts.google.com to login with google in incognito mode.');
        }
        else { Alert.error('Login Failed'); }
        ctrl.showLogin = false;
        ctrl.clearLoginFields();
      });
    };

    // Registration
    this.registerUser = {}; // Register form model
    this.showRegister = false; // Toggling show will open/close modal
    this.showRegisterSuccess = false;
    this.clearRegisterFields = function() {
      // Delay clearing fields to hide clear from users
      $timeout(function() {
        ctrl.registerUser = {};
        // manual clear because angular validation bug
        ctrl.registerUser.email = '';
        ctrl.registerUser.username = '';
      }, 500);
    };

    this.register = function() {
      if (Session.isAuthenticated()) {
        Alert.error('Cannot register new user while logged in.');
        return;
      }

      Auth.register(ctrl.registerUser)
      .then(function(registeredUser) {
        ctrl.showRegister = false;
        ctrl.clearRegisterFields();
        if (registeredUser.confirm_token) {
          $timeout(function() { ctrl.showRegisterSuccess = true; }, 500);
        }
        else {
          $timeout(function() { $state.go($state.current, $stateParams, { reload: true }); }, 500);
        }
      })
      .catch(function(err) {
        if (err.status === 423) { Alert.error(err.data.message); }
        else { Alert.error('Registration Error'); }
      });
    };
  }
];

module.exports = angular.module('ept.header', [])
.controller('HeaderCtrl', ctrl)
.name;
