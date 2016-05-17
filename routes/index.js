var express = require('express');
var router = express.Router();
var rcmIsAllowed = require('../acl/rcmIsAllowed');

router.use(require('../middleware/sharedSessionReader'));

router.get('/', function (req, res, next) {//@TODO remove this acl test
    rcmIsAllowed(req, 'id-image', null, function (isAllowed, reason) {
        console.log('isAllowed:', isAllowed, reason);
    });
    next();
});

router.get('/:pageName?', require('../controllers/rcm'));


module.exports = router;
