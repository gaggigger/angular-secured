angular.module('ngSecured', ["ui.router"]).run(["ngSecured", function(ngSecured){}] );

angular.module("ngSecured")
.directive("asRole", ["ngSecured", "$animate",
                       function(ngSecured, $animate){
        return {
            transclude: "element",
            priority: 600,
            terminal: true,
            restrict: 'A',
            $$tlb: true,
            link: function($scope, $element, $attrs, ctrl, $transclude){
                var block, childScope,
                    role;

                function getBlockElements(nodes) {
                    var startNode = nodes[0],
                        endNode = nodes[nodes.length - 1];
                    if (startNode === endNode) {
                        return angular.element(startNode);
                    }

                    var element = startNode;
                    var elements = [element];

                    do {
                        element = element.nextSibling;
                        if (!element) break;
                        elements.push(element);
                    } while (element !== endNode);

                    return angular.element(elements);
                }

                function invalidateDom(){
                    console.log("role", role);
                    console.log("getRoles", ngSecured.getRoles());
                    if (ngSecured.includesRole(role)){

                        if (!childScope){
                            childScope = $scope.$new();
                            $transclude(childScope, function(clone){
                                clone[clone.length++] = document.createComment(' end asRole: ' + $attrs.asRole + ' ');
                                block = {clone:clone};
                                $animate.enter(clone, $element.parent(), $element);
                            })
                        }
                    }else{
                        if (block){
                            $animate.leave(getBlockElements(block.clone));
                            block = null;
                        }
                        if (childScope){
                            childScope.$destroy();
                            childScope = null;
                        }
                    }
                }

                // TODO: consider changing to $observe
                $scope.$watch(function(){return $attrs.asRole;}, function(newVal){
                    role = newVal;
                    invalidateDom();
                });
                $scope.$watch(function(){return ngSecured.getRoles();}, invalidateDom);
            }
        }
    }])
angular.module("ngSecured")
    .provider("ngSecured", ["$stateProvider", function ($stateProvider) {

        var baseStateName = "private__ngSecured",
            defaultStateNames = {
                "BASE_STATE": baseStateName,
                "NOT_AUTHENTICATED": baseStateName + ".notAuthenticated",
                "NOT_AUTHORIZED": baseStateName + ".notAuthorized"
            },
            config = {
                loginState: defaultStateNames.NOT_AUTHENTICATED,
                unAuthorizedState: defaultStateNames.NOT_AUTHORIZED,
                isAuthenticated: function () {
                    return false
                },
                postLoginState: defaultStateNames.NOT_AUTHENTICATED
            };

        $stateProvider.state(defaultStateNames.BASE_STATE, {});
        $stateProvider.state(defaultStateNames.NOT_AUTHENTICATED, {views: {"@": {template: "please login to see this page."}}});
        $stateProvider.state(defaultStateNames.NOT_AUTHORIZED, {views: {"@": {template: "You are not authorized to see this page."}}});


        this.secure = function (userConfig) {
            angular.extend(config, userConfig);

        }

        this.$get = ["$rootScope", "$state", "$q", "$injector",
            function ($rootScope, $state, $q, $injector) {

                var lastStateName,
                    lastStateParams,
                    roles;

                function initVars() {
                    lastStateName = config.postLoginState;
                }

                initVars();

                $rootScope.$on("$stateChangeStart", function (event, toState, toParams) {
                    if (!!toState.secured) {

                        if (!isAuthenticated()) {
                            event.preventDefault();
                            lastStateName = toState.name;
                            lastStateParams = toParams;
                            $state.go(config.loginState);
                        } else if (toState.secured.hasOwnProperty("role")) {

                            if (!roles || roles.indexOf(toState.secured.role)) {

                                event.preventDefault();
                                $state.go(config.unAuthorizedState);
                            }
                        }
                    }
                })

                function goToLastState() {
                    if (lastStateName) {
                        $state.go(lastStateName, lastStateParams);
                    }
                }

                function isAuthenticated(){
                    return $injector.invoke(config.isAuthenticated);
                }

                return {
                    defaultStateNames: defaultStateNames,
                    _initVars: initVars,

                    login: function (credentials) {

                        if (!config.login) {
                            throw new Error("login function must be configured");
                        } else {
                            var rolesPossiblePromise = $injector.invoke(config.login, config, {credentials: credentials});

                            if (rolesPossiblePromise){
                                var that = this;
                                return $q.when(rolesPossiblePromise).then(
                                    function (rolesValue) {
                                        if (rolesValue) {
                                            that.setRoles(rolesValue);
                                        }
                                        goToLastState();
                                        return rolesValue;
                                    }
                                )
                            }
                            goToLastState();
                            return $q.reject("No promise was returned from login");

                        }
                    },

                    isAuthenticated: isAuthenticated,

                    setRoles: function (rolesValue) {
                        if (angular.isString(rolesValue)) {
                            roles = [rolesValue];
                        } else if (!angular.isArray(rolesValue)) {
                            throw new Error("roles must be a String or an Array");
                        } else {
                            roles = rolesValue;
                        }
                    },

                    getRoles: function () {
                        return roles;
                    },

                    includesRole: function (role) {
                        if (roles && roles.indexOf(role) !== -1) {
                            return true;
                        }
                        return false;
                    }


                }
            }];
    }])