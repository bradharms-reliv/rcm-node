var express = require('express');
var router = express.Router();

var rcm = require('../controllers/rcm');

var mysql = require('mysql');
var conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wespresslocal'
});

conn.connect();


/* GET home page. */
router.get('/:pageName?', rcm(conn));


module.exports = router;
