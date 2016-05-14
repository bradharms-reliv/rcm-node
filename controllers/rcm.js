var cps = require('cps');
var mysql = require('mysql');
var request = require('request');

function getPluginInnerHtml(plugin, cb) {
    //If we know how to render the plugin, do it. Otherwise get from API if its a PHP plugin
    if (plugin.plugin == 'RcmHtmlArea') {
        cb(JSON.parse(plugin.instanceConfig).html);
    } else {
        request.get(
            {
                url: 'https://reliv.com/rcm-admin-get-instance/' + plugin.plugin + '/' + plugin.instanceId
            },
            function (err, pluginRes) {
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

module.exports = function (conn) {
    return function (httpReq, httpRes, next) {

        var pageName = httpReq.params.pageName;
        var domainName = 'local.reliv.com'; //@TODO httpRes.get('host');
        if (!pageName) {
            pageName = 'index';
        }

        //console.log(domainName, pageName);

        var pageData = {};

        cps.seq([
            function (_, cb) {
                var sql = 'select rcm_pages.publishedRevisionId, rcm_pages.pageTitle, rcm_pages.description, rcm_pages.keywords ' +
                    'from rcm_pages ' +
                    'join rcm_sites on rcm_pages.siteId = rcm_sites.siteId ' +
                    'join rcm_domains on rcm_domains.domainId = rcm_sites.domainId ' +
                    'where name = ? and rcm_domains.domain=?' +
                    ' limit 1';
                conn.query(sql, [pageName, domainName], cb);
            },
            function (res, cb) {
                pageData = res;
                var sql = 'SELECT layoutContainer, renderOrder, rowNumber, columnClass, plugin, instanceConfig, rcm_plugin_instances.pluginInstanceId as instanceId, displayName, rcm_plugin_wrappers.pluginWrapperId, siteWide as isSiteWide ' +
                    'FROM rcm_plugin_wrappers ' +
                    'join rcm_revisions_plugin_wrappers on rcm_revisions_plugin_wrappers.pluginWrapperId = rcm_plugin_wrappers.pluginWrapperId ' +
                    'join rcm_plugin_instances on rcm_plugin_instances.pluginInstanceId = rcm_plugin_wrappers.pluginInstanceId ' +
                    'where revisionId = ? ' +
                    'order by layoutContainer asc, renderOrder asc, rowNumber asc;';
                conn.query(
                    sql,
                    [res[0].publishedRevisionId],
                    cb
                );
            },
            function (res, cb) {
                pageData.contNames = [];
                pageData.conts = {};
                pageData.contInnerHtmls = {};

                var pluginsStillGettingHtml = 0;

                res.forEach(function (plugin) {
                    pageData.contNames.push(plugin.layoutContainer);
                    pluginsStillGettingHtml++;
                    getPluginHtml(plugin, function (html) {
                        pageData.contInnerHtmls[plugin.layoutContainer] += html;
                        pluginsStillGettingHtml--;
                        if (pluginsStillGettingHtml == 0) {
                            cb()
                        }
                    });
                });
            },
            function (_, cb) {
                pageData.contNames.forEach(function (contName) {
                    pageData.conts[contName] = '<div class="container-fluid rcmContainer"'
                    + ' data-containerId="' + contName + '"'
                    + ' data-containerRevision="'
                    + '@TODO' //@TODO $revisionId
                    + '"';
                    //@TODO if ($pageContainer) {
                    //    $html. = ' data-isPageContainer="Y"';
                    //}
                    pageData.conts[contName] += ' id="' + contName + '">'
                    + '<div class="row">' //@todo read rows from db
                    + pageData.contInnerHtmls[contName] + '</div>' +
                    '</div>';
                });
                cb();
            },
            function (_, cb) {
                //@todo add title, desc, keywords
                httpRes.render('GuestResponsive/layout/guest-responsive-home-page', pageData);
            }
        ], function (err) {
            console.error(err, err.stack)
        });
    }
};


