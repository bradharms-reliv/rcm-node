var conn = require('../dbConnections/mysql');
var mysql = require('mysql');
var cps = require('cps');

/**
 * @callback isAllowedCallback
 * @param {boolean} isAllowed
 * @param {string} reason
 */

/**
 * Calls the given callback with a boolean that represents
 * whether or not the user the current request is for
 * has access to the given resourceId and privilageId.
 *
 * @TODO support resource inheritance
 * @TODO support super admin if we decide to (not currently implemented)
 *
 * @param {Request} req
 * @param {string} resourceId
 * @param {string} [privilegeId] optional privilegeId to check
 * @param {isAllowedCallback} callback
 * @returns null
 */
module.exports = function (req, resourceId, privilegeId, callback) {

    if (!req.session
        || !req.session.RcmUser
        || !req.session.RcmUser.user
        || !req.session.RcmUser.user.properties
        || !req.session.RcmUser.user.properties.RcmUserUserRoles
    ) {
        return false;
    }

    if (req.session.RcmUser.user.properties.RcmUserUserRoles > 1) {
        throw new Error('Multiple roles are not supported.');
    }

    var role = req.session.RcmUser.user.properties.RcmUserUserRoles[0];

    var requestAclData = {
        currentRequestRoleAndParents: [],
        relevantRules: []
    };

    cps.seq([
        /**
         * Query the DB for all roles
         *
         * @param _
         * @param cb
         */
         function (_, cb) {
            var sql = 'SELECT parentRoleId, roleId FROM rcm_user_acl_role';
            conn.query(sql, [], cb);
         },
        /**
         * Process the list of all roles into a list of only our role and
         * our parents. This is for the user that the current request is for.
         *
         * @param allDbRoles
         * @param cb
         */
         function (allDbRoles, cb) {
            var currentRoleInLoop = role;
            var done = false;
            while (!done) { //Web storm doesn't like while(true);
                for (var roleI = 0, roleLen = allDbRoles.length; roleI < roleLen; roleI++) {
                    var dbRole = allDbRoles[roleI];
                    if (dbRole.roleId == currentRoleInLoop) {
                        if (!dbRole.parentRoleId) {
                            done = true;
                            break;
                        }
                        requestAclData.currentRequestRoleAndParents.push(currentRoleInLoop);
                        currentRoleInLoop = dbRole.parentRoleId;
                    }
                }
            }
            cb()
        },
        /**
         * Query the DB for all rules that may be relevant to the current request.
         *
         * @param _
         * @param cb
         */
         function (_, cb) {
            var sql = 'SELECT roleId, rule, resourceId, privileges ' +
                'FROM wespresslocal.rcm_user_acl_rule ' +
                'WHERE roleId in ' + mySqlEscapeArray(requestAclData.currentRequestRoleAndParents) +
                'AND resourceId = ?';
            var params = [resourceId];
            conn.query(sql, params, cb);
        },
        /**
         * Store the relevant rules for further use
         *
         * @param relevantRules
         * @param cb
         */
        function (relevantRules, cb) {
            requestAclData.relevantRules = relevantRules;
            cb();
        },
        /**
         * Go through the relevant rules, determine if "isAllowed", and call the main callback
         * with the result
         *
         * @param _
         * @param cb
         */
        function (_, cb) {
            //@TODO this is the general area to add resource inheritance support
            var foundAnswerAndCalledMainCallback = false;
            for (var roleI = 0, roleLen = requestAclData.currentRequestRoleAndParents.length; roleI < roleLen; roleI++) {
                var roleIdToCheck = requestAclData.currentRequestRoleAndParents[roleI];
                var allowed = false;
                var denied = false;
                for (var ruleI = 0, ruleLen = requestAclData.relevantRules.length; ruleI < ruleLen; ruleI++) {
                    var relevantRule = requestAclData.relevantRules[ruleI];

                    if (roleIdToCheck != relevantRule.roleId) {
                        continue;
                    }

                    var dbPrivileges = JSON.parse(relevantRule.privileges);

                    /**
                     * If privileges is an empty array in the db, this means all privileges.
                     * If privilegeId not was passed to us, this means any privilege in the DB will do. //@TODO verify this line
                     */
                    if (dbPrivileges.length && privilegeId && !dbPrivileges.indexOf(privilegeId)) {
                        continue;
                    }

                    if (relevantRule.rule == 'allow') {
                        allowed = true;
                    }

                    if (relevantRule.rule == 'deny') {
                        denied = true;
                    }
                }

                if (allowed && !denied) {
                    callback(true, 'Rule found');
                    foundAnswerAndCalledMainCallback = true;
                    break;
                }

                if (denied) {
                    callback(false, 'Rule found');
                    foundAnswerAndCalledMainCallback = true;
                    break;
                }
            }
            if (!foundAnswerAndCalledMainCallback) {
                callback(false, 'No rule found')
            }
        }
        ], function (err) {
            //This is the error handler for cps.seq()
            console.error(err, err.stack)
        }
    )
    ;
};

function mySqlEscapeArray(array) {
    var escapedInStatement = '';
    var comma = '';
    array.forEach(function (value) {
        escapedInStatement += comma + mysql.escape(value);
        comma = ',';
    });
    return '(' + escapedInStatement + ')';
}
