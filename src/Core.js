const Jimp = require('jimp');
const rp = require('request-promise');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

module.exports = {
    invertPngAsync: async function (uri) {
        return new Promise((reject, resolve) => {
            Jimp
                .read(uri)
                .then(icon => {
                    icon
                        .invert()
                        .write(`${uri.slice(0, -4)}.dark.png`, () => {
                            resolve()
                        })
                })
                .catch(err => {
                    console.error(err);
                    reject()
                });
        })
    },

    rpGet: async function (uri, authorization, qs) {
        return rp({
            url: uri,
            json: true,
            headers: {
                'Authorization': authorization
            },
            qs: qs
        }).catch(err => {
            vscode.window.showErrorMessage(err.error.message || err)
        })
    },

    getApp: function (item) {
        return item.parent === undefined ? item : this.getApp(item.parent)
    },

    isVersionable: function (item) {
        return !(["connection", "webhook"].includes(item))
    },

    contextGuard: function (context) {
        if (context === undefined || context === null) {
            vscode.window.showErrorMessage("This command should not be called directly. Please use it from application context menu.")
            return false
        }
        return true
    },

    isFilled: function (subject, object, thing, article, the) {
        if (thing === undefined || thing === "" || thing === null) {
            vscode.window.showWarningMessage(`${article || "A"} ${subject} for ${the === false ? "" : "the"} ${object} has not been specified.`)
            return false
        }
        return true
    },

    addEntity: function (authorization, body, uri) {
        return rp({
            method: 'PUT',
            uri: uri,
            body: body,
            headers: {
                Authorization: authorization
            },
            json: true
        }).catch(err => {
            vscode.window.showErrorMessage(err.error.message)
        })
    },

    deleteEntity: function (authorization, body, uri) {
        return rp({
            method: 'DELETE',
            uri: uri,
            body: body,
            headers: {
                Authorization: authorization
            },
            json: true
        }).catch(err => {
            vscode.window.showErrorMessage(err.error.message)
        })
    },

    editEntity: function (authorization, body, uri) {
        return rp({
            method: 'POST',
            uri: uri,
            body: body,
            headers: {
                Authorization: authorization
            },
            json: true
        }).catch(err => {
            vscode.window.showErrorMessage(err.error.message)
        })
    },

    editEntityPlain: function (authorization, value, uri) {
        return rp({
            method: 'POST',
            uri: uri,
            body: value,
            headers: {
                Authorization: authorization,
                "Content-Type": "text/plain",
            }
        }).catch(err => {
            vscode.window.showErrorMessage(err.error.message)
        })
    },

    getAppObject: async function (environment, authorization, app) {
        try {
            return await this.rpGet(`${environment}/app/${app.name}/${app.version}`, authorization)
        }
        catch (err) {
            vscode.window.showErrorMessage(err.error.message)
        }
    },

    getIconHtml: function (uri, color, dir) {
        return (fs.readFileSync(path.join(dir, 'static', 'icon.html'), "utf8")).replace("___iconbase", uri).replace("___theme", color)
    },

    getRpcTestHtml: function (name, app, version, dir) {
        return (fs.readFileSync(path.join(dir, 'static', 'rpc-test.html'), "utf8")).replace("___rpcName", name).replace("___appName", app).replace("___version", version)
    },

    compareCountries: function (a, b) {
        // Sort by PICK
        if (a.picked && !b.picked) return -1;
        if (b.picked && !a.picked) return 1;

        // Sort by NAME
        return a.label.localeCompare(b.label)
    },

    compareApps: function (a, b) {
        return a.bareLabel.localeCompare(b.bareLabel)
    }
}