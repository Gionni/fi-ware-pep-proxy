var config = require('../config.js'),
    proxy = require('./HTTPClient.js');


var IDM = (function() {

    var my_token,
        //{token: {user_info: {}, date: Date}}
        tokens_cache = {};

    var authenticate = function(callback, callbackError) {

        var options = {
            host: config.keystone_host,
            port: config.keystone_port,
            path: '/v2.0/tokens',
            method: 'POST',
            headers: {}
        };
        var body = {auth: {passwordCredentials: {username: config.username, password: config.password}}}
        proxy.sendData('http', options, JSON.stringify(body), undefined, function (status, resp) {
            my_token = JSON.parse(resp).access.token.id;
            callback(my_token);
        }, callbackError);
    };

    var check_token = function(token, action, resource, callback, callbackError) {

        var options = {
            host: config.keystone_host,
            port: config.keystone_port,
            path: '/v2.0/access-tokens/' + encodeURIComponent(token),
            method: 'GET',
            headers: {'X-Auth-Token': my_token, 'Accept': 'application/json'}
        };
        
        if (action && resource) {
            options.path = '/v2.0/access-tokens/authREST/' + encodeURIComponent(token);
            options.headers = { 
                'X-Auth-Token': my_token,
                'x-auth-action': action,
                'x-auth-resource': resource,
                'Accept': 'application/json'
            };
        }

        if (tokens_cache[token]) {
            console.log('[TOKEN] Token in cache, checking timestamp...');
            var current_time = (new Date()).getTime();
            var token_time = tokens_cache[token].date.getTime();

            if (current_time - token_time < config.chache_time * 1000) {
                console.log('[TOKEN] Access-token OK. Redirecting to app...');
                tokens_cache[token].date = new Date();
                callback(tokens_cache[token].user_info);
                return;
            } else {
                console.log('[TOKEN] Token in cache expired');
                delete tokens_cache[token];
            }
        }
        
        console.log('[TOKEN] Checking token with IDM...');

        proxy.sendData('http', options, undefined, undefined, function (status, resp) {
            console.log('[TOKEN] Access-token OK. Redirecting to app...');
            var user_info = JSON.parse(resp);
            tokens_cache[token] = {};
            tokens_cache[token].date = new Date();
            tokens_cache[token].user_info = user_info;
            callback(user_info);
        }, function (status, e) {
            if (status === 401) {

                console.log('[TOKEN] Error validating token. Proxy not authorized in keystone. Keystone authentication ...');   
                authenticate (function (status, resp) {

                    my_token = JSON.parse(resp).access.token.id;

                    console.log('[TOKEN] Success authenticating PEP proxy. Proxy Auth-token: ', my_token);
                    check_token(token, callback, callbackError);

                }, function (status, e) {
                    console.log('[TOKEN] Error in IDM communication ', e);
                    callbackError(503, 'Error in IDM communication');
                });
            } else {
                callbackError(status, e);
            }
        });
    };


    return {
        authenticate: authenticate,
        check_token: check_token
    }

})();
exports.IDM = IDM;