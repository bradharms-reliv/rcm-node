var mysql = require('mysql');
var conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wespresslocal'
});

conn.connect();

var rcmInstance = require('../controllers/rcm')(conn);
var sharedSessionReader = require('../middleware/sharedSessionReader')(conn);


////////////////////////


var express = require('express');
var router = express.Router();

router.use(sharedSessionReader);

router.get('/:pageName?', rcmInstance);

module.exports = router;
