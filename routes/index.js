var express = require('express');
var rcmIsAllowed = require('../acl/rcmIsAllowed');
var sharedSessionReader = require('../middleware/sharedSessionReader');


var router = express.Router();

router.use(sharedSessionReader);

router.get('/', function (req, res, next) {//@TODO remove this acl test
    rcmIsAllowed(req, 'id-image', null, function (isAllowed, reason) {
        console.log('isAllowed:', isAllowed, reason);
    });
    next();
});

router.get('/:pageName?', require('../controllers/rcm'));


module.exports = router;
