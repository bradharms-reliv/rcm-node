/**
 * This middleware reads the shared RCM session that
 * came from PHP and injects it into req.session
 *
 * Try console.log(req.session);
 *
 * @param conn mysql connection
 * @returns {Function}
 */
module.exports = function (conn) {
    return function (req, res, next) {
        var sessionName = 'reliv_session_id_local';//@todo dynamically get name depending on env

        var sql = 'select json, modified, lifetime from app_session where id = ? and name = ? limit 1';
        var params = [req.cookies[sessionName], sessionName];
        conn.query(sql, params, function (err, rows) {
            if (err) {
                console.error(err);
                next();
            }

            var session = rows[0];

            //Ignore session if it is expired.
            if (session.modified + session.lifetime > Math.floor(Date.now() / 1000)) {
                req.session = JSON.parse(session.json);
            }

            next();
        });
    }
};
