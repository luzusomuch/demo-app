/**
 * Created by konlambigue on 24/06/2016.
 */
var express = require('express');
var http = require('http');
var redis = require('redis');
var bunyan = require('bunyan');
var cluster = require('cluster');

var compress = require('compression');
var cookieParser = require('cookie-parser');
var session = require('express-session');

var config = require('easy-config');
var RedisStore = require('connect-redis')(session);
var easySession = require('easy-session');
var cservice = require('cluster-service');
var cors = require('cors');

var utils = require('./lib/utils');

require('./lib/req-res');

if(cluster.isMaster && !config.noLog) {
    //Display config in log file on startup.
    console.log(JSON.stringify(config, undefined, 2));
}

var app     = express();

app.use(require('prerender-node'));

var log = bunyan.createLogger(config.extend(config.log, {
    serializers: {
        req: bunyan.stdSerializers.req,
        error: bunyan.stdSerializers.err
    }
}));

var sessionConf = {
    store: new RedisStore(config.extend(config.redis, {
        retry_max_delay: 1000,
        connect_timeout: 1000,
        debug_mode: true,
        ttl: (config.sessionLifetime && (config.sessionLifetime / 1000) || (15 * 60)) // 15 minutes
    })),
    name: config.session.id, // use a generic id
    secret: config.session.secret,
    resave: true,
    saveUninitialized: true
};

var redisClient = require('./lib/db').create('redis');

app.use(express.static(__dirname + "/dist"));
app.use(/^\/%7B%7B.+/, function (req, res, next) {
    res.status(404).send('Not found');
});

app.use(function (req, res, next) {
    res.locals.lngName = (req.cookies && req.cookies['user-lng'] || 'fr_FR');
    next();
});

app.use(function (req, res, next) {
    if (req.path === '/autodiscover/autodiscover.xml' || req.path === '/favicon.ico') {
        res.sendStatus(404);
        return;
    }
    if (req.path === '/robots.txt') {
        res.sendfile(__dirname + '/robots.txt');
        return;
    }
    next();
});

app.use(compress());
app.use(cookieParser(config.session.secret));
app.use(session(sessionConf));

app.use(require('./lib/csrf')(config.csrf));

app.use(require('./lib/cache')(redisClient)); // Add cache handle

app.use(require('./lib/countries'));

app.use(function (req, res, next) {

    req._id = Math.random().toString(36).substr(2);
    req.session.sid = req.session.sid || Math.random().toString(36).substr(2);

    //Attach log and redis
    var ext = {
        req_id: req._id,
        path: req.path,
        ip: req.ip,
        method: req.method,
        sid: req.session.sid
    };

    //var uid = utils.getVal(req.session, 'cookie.uid');

    var uid = req.session.uid;

    if (uid) {
        ext.uid = uid;
    }
    req.log = log.child(ext);

    var rPath = req.path;
    if (rPath.indexOf('/') === 0) {
        rPath = rPath.substr(1);
    }
    if (!rPath) {
        res.locals.bodyClass = 'index';
    } else {
        res.locals.bodyClass = rPath.split('/').shift().toLowerCase();
    }

    req.redis = redisClient;

    if (req.header('x-requested-with')) {
        req._xhr = true;
    }

    // Log request start
    req.log.debug('Incoming request');

    var start = Date.now();

    function logRequest () {
        res.removeListener('finish', logRequest);
        res.removeListener('close', logRequest);
        req.log.info({
            request_time: Date.now() - start,
            status_code: this.statusCode
        }, 'Request end');
    }

    res.on('finish', logRequest);
    res.on('close', logRequest);

    next();
});

app.use(easySession.main(session, config.session || {}));

/*app.all('*', function (req, res, next) {
    next(req._httpError(404));
});*/

app.get('/*', function(req, res) {
    res.sendFile("./dist/index.html", { root: __dirname });
});



app.listen(config.port, function () {
    log.info('%s listening on %d', config.name, config.port);
});
