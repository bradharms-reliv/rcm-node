var express = require('express');
var isAllowed = require('../rcmAdaptor/acl/isAllowed');
var sharedSessionReader = require('../rcmAdaptor/middleware/sharedSessionReader');
var pageController = require('../controllers/rcm');


var router = express.Router();

router.use(sharedSessionReader); //Injects sessions from RcmUser into req.session

router.get('/', function (req, res, next) {//@TODO remove this acl test
    isAllowed(req, 'id-image', null, function (isAllowed, reason) {
        console.log('isAllowed:', isAllowed, reason);
    });
    next();
});

router.get('/:pageName?', pageController); //Renders rcm pages


module.exports = router;
