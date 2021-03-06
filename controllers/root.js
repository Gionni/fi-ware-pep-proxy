var config = require('./../config.js'),
    proxy = require('./../lib/HTTPClient.js'),
    IDM = require('./../lib/idm.js').IDM;

var Root = (function() {

    var pep = function(req, res) {
    	
    	var auth_token = req.headers['x-auth-token'];

        if (auth_token === undefined && req.headers['authorization'] !== undefined) {
            auth_token = atob(req.headers['authorization'].split(' ')[1]);
        }

    	if (auth_token === undefined) {
            console.log('Auth-token not found in request header');
            var auth_header = 'IDM uri = ' + config.account_host;
            res.set('WWW-Authenticate', auth_header);
    		res.send(401, 'Auth-token not found in request header');
    	} else {

            if (config.magic_key && config.magic_key === auth_token) {
                var options = {
                    host: config.app_host,
                    port: config.app_port,
                    path: req.url,
                    method: req.method,
                    headers: proxy.getClientIp(req, req.headers)
                };
                proxy.sendData('http', options, req.body, res);
                return;

            }

            var action, resource;

            if (config.check_permissions) {
                action = req.method;
                resource = req.url.substring(1, req.url.length);
                //console.log('Action: ', action);
                //console.log('Resource: ', resource);
            }

    		IDM.check_token(auth_token, action, resource, function (user_info) {

                req.headers['X-Nick-Name'] = user_info.nickName;
                req.headers['X-Display-Name'] = user_info.displayName;
                req.headers['X-Roles'] = user_info.roles;
                req.headers['X-Organizations'] = user_info.organizations;

    			var options = {
    		        host: config.app_host,
    		        port: config.app_port,
    		        path: req.url,
    		        method: req.method,
    		        headers: proxy.getClientIp(req, req.headers)
    		    };
    		    proxy.sendData('http', options, req.body, res);

    		}, function (status, e) {
    			if (status === 404) {
                    console.log('User access-token not authorized');
                    res.send(401, 'User token not authorized');
                } else {
                    console.log('Error in IDM communication ', e);
                    res.send(503, 'Error in IDM communication');
                }
    		});
    	}

    	
    }

    return {
        pep: pep
    }
})();

exports.Root = Root;