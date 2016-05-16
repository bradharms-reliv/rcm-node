var rcm = require('../controllers/rcm');

var mysql = require('mysql');
var conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wespresslocal'
});

conn.connect();

var rcmInstance = rcm(conn);



////////////////////////




var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/:pageName?', rcmInstance);

module.exports = router;
