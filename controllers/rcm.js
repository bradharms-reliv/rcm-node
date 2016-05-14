var cps = require('cps');
var mysql = require('mysql');
var request = require('request');

module.exports = function (conn) {
    return function (httpReq, httpRes, next) {

        var pageData = {
            pageName: httpReq.params.pageName ? httpReq.params.pageName : 'index',
            domainName: httpReq.headers.host.split(':')[0]
        };

        cps.seq([
            function (_, cb) {
                var sql = 'select rcm_pages.publishedRevisionId, rcm_pages.pageTitle, rcm_pages.description, ' +
                    'rcm_pages.keywords, rcm_sites.siteId, rcm_sites.theme ' +
                    'from rcm_pages ' +
                    'join rcm_sites on rcm_pages.siteId = rcm_sites.siteId ' +
                    'join rcm_domains on rcm_domains.domainId = rcm_sites.domainId ' +
                    'where name = ? and rcm_domains.domain=?' +
                    ' limit 1';
                conn.query(sql, [pageData.pageName, pageData.domainName], cb);
            },
            function (res, cb) {
                pageData = res[0];

                var theme = require('../views/' + pageData.theme);

                var escapedInStatement = '';
                var comma = '';
                theme.siteWideContainerNames.forEach(function (value) {
                    escapedInStatement += comma + mysql.escape(value);
                    comma = ',';
                });

                var sql = 'SELECT revisionId, layoutContainer, renderOrder, rowNumber, columnClass, plugin, instanceConfig,' +
                    'rcm_plugin_instances.pluginInstanceId as instanceId, displayName,' +
                    'rcm_plugin_wrappers.pluginWrapperId, siteWide as isSiteWide ' +
                    'FROM rcm_plugin_wrappers ' +
                    'join rcm_revisions_plugin_wrappers on rcm_revisions_plugin_wrappers.pluginWrapperId = rcm_plugin_wrappers.pluginWrapperId ' +
                    'join rcm_plugin_instances on rcm_plugin_instances.pluginInstanceId = rcm_plugin_wrappers.pluginInstanceId ' +
                    'where revisionId = ? ' +
                    "/***/ UNION /***/ " +
                    'SELECT rcm_revisions_plugin_wrappers.revisionId, layoutContainer, renderOrder, rowNumber, columnClass, plugin, instanceConfig,' +
                    'rcm_plugin_instances.pluginInstanceId as instanceId, displayName,' +
                    'rcm_plugin_wrappers.pluginWrapperId, siteWide as isSiteWide ' +
                    'FROM rcm_plugin_wrappers ' +
                    'join rcm_revisions_plugin_wrappers on rcm_revisions_plugin_wrappers.pluginWrapperId = rcm_plugin_wrappers.pluginWrapperId ' +
                    'join rcm_plugin_instances on rcm_plugin_instances.pluginInstanceId = rcm_plugin_wrappers.pluginInstanceId ' +
                    'join rcm_containers on rcm_containers.publishedRevisionId = rcm_revisions_plugin_wrappers.revisionId ' +
                    'where rcm_containers.name in (' + escapedInStatement + ') ' +
                    'and rcm_containers.siteId = ? ' +
                    'order by layoutContainer asc, rowNumber asc, renderOrder asc;';
                conn.query(
                    sql,
                    [pageData.publishedRevisionId, pageData.siteId],
                    cb
                );
            },
            function (res, cb) {
                pageData.contNames = [];
                pageData.conts = {};
                pageData.contInnerHtmls = {};
                pageData.contRevisionIds = {};

                var pluginsStillGettingHtml = 0;

                res.forEach(function (plugin) {
                    if (pageData.contNames.indexOf(plugin.layoutContainer) == -1) {
                        pageData.contNames.push(plugin.layoutContainer);
                        pageData.contRevisionIds[plugin.layoutContainer] = plugin.revisionId;
                        pageData.contInnerHtmls[plugin.layoutContainer] = '';
                        pageData.contInnerHtmls[plugin.layoutContainer] = [];
                    }
                    pluginsStillGettingHtml++;
                    getPluginHtml(plugin, function (html) {
                        if (pageData.contInnerHtmls[plugin.layoutContainer][plugin.rowNumber] == undefined) {
                            pageData.contInnerHtmls[plugin.layoutContainer][plugin.rowNumber] = [];
                        }
                        pageData.contInnerHtmls[plugin.layoutContainer][plugin.rowNumber][plugin.renderOrder] = html;
                        pluginsStillGettingHtml--;
                        if (pluginsStillGettingHtml == 0) {
                            cb()
                        }
                    });
                });
            },
            function (_, cb) {
                pageData.contNames.forEach(function (contName) {
                    pageData.conts[contName] = getContainerHtml(pageData, contName);
                });
                cb();
            },
            function (_, cb) {
                //@todo add title, desc, keywords
                httpRes.render(pageData.theme + '/layout', pageData);
            }
        ], function (err) {
            console.error(err, err.stack)
        });
    }
};

function getContainerHtml(pageData, contName) {
    var html = '<div class="container-fluid rcmContainer"'
        + ' data-containerId="' + contName + '"'
        + ' data-containerRevision="' + pageData.contRevisionIds[contName] + '"';

    //@TODO if ($pageContainer) {html. = ' data-isPageContainer="Y"';}

    html += ' id="' + contName + '">';

    pageData.contInnerHtmls[contName].forEach(function (row) {
        html += '<div class="row">' + row.join('') + '</div>'
    });

    html += '</div>';
    return html;
}

function getPluginInnerHtml(plugin, cb) {
    //If we know how to render the plugin, do it. Otherwise get from API if its a PHP plugin
    if (plugin.plugin == 'RcmHtmlArea') {
        cb(JSON.parse(plugin.instanceConfig).html);
    } else {
        var url = 'https://base.reliv.com/rcm-admin-get-instance/' + plugin.plugin + '/' + plugin.instanceId;
        request.get({url: url}, function (err, pluginRes) {
            cb(pluginRes.body);
        })
    }
}

function getPluginHtml(plugin, cb) {
    if (plugin.displayName == null) {
        plugin.displayName = '';
    }
    var preHtml = '<div class="rcmPlugin ' + plugin.plugin + ' ' + plugin.displayName
        + ' ' + plugin.columnClass + '"'
        + ' data-rcmPluginName="' + plugin.plugin + '"'
        + ' data-rcmPluginDefaultClass="rcmPlugin ' + plugin.plugin
        + plugin.displayName + '"'
        + ' data-rcmPluginColumnClass="' + plugin.columnClass
        + '"'
        + ' data-rcmPluginRowNumber="' + plugin.rowNumber
        + '"'
        + ' data-rcmPluginRenderOrderNumber="'
        + plugin.renderOrder + '"'
        + ' data-rcmPluginInstanceId="' + plugin.instanceId + '"'
        + ' data-rcmPluginWrapperId="' + plugin.pluginWrapperId
        + '"'
        + ' data-rcmSiteWidePlugin="' + plugin.isSiteWide + '"'
        + ' data-rcmPluginDisplayName="' + plugin.displayName + '"'
        + '>';

    preHtml += '<div class="rcmPluginContainer">';
    var postHtml = '</div></div>';

    getPluginInnerHtml(plugin, function (innerHtml) {
        cb(preHtml + innerHtml + postHtml);
    });
}
