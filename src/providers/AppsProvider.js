const vscode = require('vscode');

const App = require('../tree/App');
const Group = require('../tree/Group')
const Item = require('../tree/Item')
const Code = require('../tree/Code')
const Core = require('../Core');

const tempy = require('tempy')
const path = require('path')
const mkdirp = require('mkdirp')
const download = require('image-downloader')

class AppsProvider {
    constructor(_authorization, _baseUrl, _DIR) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._authorization = _authorization
        this._baseUrl = _baseUrl
        this._DIR = _DIR
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getParent(element) {
        return element.parent
    }

    getTreeItem(element) {
        return element
    }

    async getChildren(element) {
        /*
         * LEVEL 0 - APPS
         */
        if (element === undefined) {
            let response = await Core.rpGet(`${this._baseUrl}/app`, this._authorization)
            if (response === undefined) { return }
            let iconDir = path.join(this._DIR, "icons")
            mkdirp(iconDir)
            //TODO Implement GLOB condition to prevent downloading an existing icon
            let apps = response.map(async (app) => {
                let rand = new Date().getTime()
                let dest = path.join(iconDir, `${app.name}_${rand}.png`)
                try {
                    await download.image({
                        headers: {
                            "Authorization": this._authorization
                        },
                        url: `${this._baseUrl}/app/${app.name}/icon/512`,
                        dest: dest
                    })
                    await Core.invertPngAsync(dest);
                }
                catch (err) {
                    // Icon doesn't exist -> it has not been set yet
                }
                finally {
                    apps.push(new App(app.name, app.label, app.version, app.public, app.approved, iconDir, app.theme, app.changes, rand))
                }
            })
            return Promise.all(apps).then(() => {
                apps = apps.splice(apps.length / 2, apps.length);
                apps.sort(Core.compareApps)
                return apps;
            })
        }
        /*
         * LEVEL 1 - GROUP
         */
        else if (element.level === 0) {

            // For each group
            return [
                [`general`, "General"],
                [`connections`, "Connections"],
                [`webhooks`, "Webhooks"],
                [`modules`, "Modules"],
                [`rpcs`, "Remote procedures"],
                [`functions`, "Functions"],
                [`docs`, "Docs"]
            ].map(group => {

                // Determine the name of group
                let groupItem
                switch (group[0]) {
                    case `general`:
                        groupItem = "app"
                        break
                    case `docs`:
                        groupItem = "docs"
                        break
                    default:
                        groupItem = group[0].slice(0, -1);
                        break
                }

                // Look for changes of the group
                let groupChanges = element.changes.filter(change => {
                    if (change.group === groupItem) {
                        return change
                    }
                })

                // Return the group and push the changes into it
                return new Group(group[0], group[1], element, groupChanges)
            })
        }
        /*
         * LEVEL 2 - ITEM OR CODE
         */
        else if (element.level === 1) {

            // General
            if (element.id.includes("general")) {
                return [
                    [`base`, "Base", "Base structure all modules and remote procedures inherits from."],
                    [`common`, "Common", "Collection of common data accessible through common.variable expression. Contains sensitive information like API keys or API secrets. This collection is shared across all modules."]
                ].map(code => {
                    let change = element.changes.find(change => {
                        if (change.code == code[0]) {
                            return change
                        }
                    })
                    return new Code(code[0], code[1], element, "imljson", "app", false, change ? change.id : null, code[2])
                })
            }

            // Docs
            else if (element.id.includes("docs")) {
                return [
                    new Code(`content`, "Content", element, "md", "app"),
                    //new Code(`images`, "Images", element, "img")
                ]
            }

            // REST
            else {
                for (let needle of ["connections", "webhooks", "modules", "rpcs", "functions"]) {
                    if (element.id.includes(needle)) {
                        let name = needle.slice(0, -1);
                        let uri = ["connection", "webhook"].includes(name) ?
                            `${this._baseUrl}/app/${element.parent.name}/${name}` :
                            `${this._baseUrl}/app/${element.parent.name}/${element.parent.version}/${name}`
                        let connections = await Core.rpGet(uri, this._authorization)
                        return connections.map(item => {
                            let changes = element.changes.filter(change => {
                                if (change.item === item.name) {
                                    return change
                                }
                            })
                            return new Item(item.name, item.label || (item.name + item.args), element, name, item.type || item.type_id, item.public, item.approved, changes)
                        })
                    }
                }
            }
        }
        /*
         * LEVEL 3 - CODE
         */
        else if (element.level === 2) {
            switch (element.supertype) {
                case "connection":
                    return [
                        [`api`, "Communication", "Specifies the account validation process. This specification does not inherit from base."],
                        [`common`, "Common data", "Collection of common data accessible through common.variable expression. Contains sensitive information like API keys or API secrets."],
                        [`scopes`, "Scope list", "Collection of available scopes. (key = scope name, value = human readable scope description)"],
                        [`scope`, "Default scope", "Default scope for every new connection. Array of strings."],
                        [`parameters`, "Parameters", "Array of parameters user should fill while creating a new connection."]
                    ].map(code => {
                        let change
                        if (element.changes) {
                            change = element.changes.find(change => {
                                if (change.code == code[0]) {
                                    return change
                                }
                            })
                        }
                        return new Code(code[0], code[1], element, "imljson", "connection", false, change ? change.id : null, code[2])
                    })
                case "webhook":
                    return [
                        [`api`, "Communication", "Specification of incoming data processing. This specification does not inherit from base and does not have access to connection."],
                        [`parameters`, "Parameters", "Array of parameters user should fill while creating a new webhook."],
                        [`attach`, "Attach", "Describes how to register this webhook automatically via API. Leave empty if user needs to register webhook manually. This specification does inherit from base."],
                        [`detach`, "Detach", "Describes how to unregister this webhook automatically via API. Leave empty if user needs to unregister webhook manually. This specification does inherit from base."],
                        [`scope`, "Required scope", "Scope required by this webhook. Array of strings."]
                    ].map(code => {
                        let change
                        if (element.changes) {
                            change = element.changes.find(change => {
                                if (change.code == code[0]) {
                                    return change
                                }
                            })
                        }
                        return new Code(code[0], code[1], element, "imljson", "webhook", false, change ? change.id : null, code[2])
                    })
                case "module":
                    switch (element.type) {
                        // Action or search
                        case 4:
                        case 9:
                            return [
                                [`api`, "Communication", "This specification does inherit from base."],
                                [`parameters`, "Static parameters", "Array of static parameters user can fill while configuring the module. Static parameters can't contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
                                [`expect`, "Mappable parameters", "Array of mappable parameters user can fill while configuring the module. Mappable parameters can contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
                                [`interface`, "Interface", "Array of output variables. Same syntax as used for parameters."],
                                [`samples`, "Samples", "Collection of sample values. (key = variable name, value = sample value)"],
                                [`scope`, "Scope", "Scope required by this module. Array of strings."]
                            ].map(code => {
                                let change
                                if (element.changes) {
                                    change = element.changes.find(change => {
                                        if (change.code == code[0]) {
                                            return change
                                        }
                                    })
                                }
                                return new Code(code[0], code[1], element, "imljson", "module", false, change ? change.id : null, code[2])
                            })
                        // Trigger
                        case 1:
                            return [
                                [`api`, "Communication", "This specification does inherit from base."],
                                [`epoch`, "Epoch", "Describes how user can choose the point in the past where the trigger should start to process data from."],
                                [`parameters`, "Static parameters", "Array of static parameters user can fill while configuring the module. Static parameters can't contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
                                [`interface`, "Interface", "Array of output variables. Same syntax as used for parameters."],
                                [`samples`, "Samples", "Collection of sample values. (key = variable name, value = sample value)"],
                                [`scope`, "Scope", "Scope required by this module. Array of strings."]
                            ].map(code => {
                                let change
                                if (element.changes) {
                                    change = element.changes.find(change => {
                                        if (change.code == code[0]) {
                                            return change
                                        }
                                    })
                                }
                                return new Code(code[0], code[1], element, "imljson", "module", false, change ? change.id : null, code[2])
                            })
                        // Instant trigger
                        case 10:
                            return [
                                [`api`, "Communication", "Optional, only use when you need to make additional request for an incoming webhook. This specification does inherit from base."],
                                [`parameters`, "Static parameters", "Array of static parameters user can fill while configuring the module. Static parameters can't contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
                                [`interface`, "Interface", "Array of output variables. Same syntax as used for parameters."],
                                [`samples`, "Samples", "Collection of sample values. (key = variable name, value = sample value)"]
                            ].map(code => {
                                let change
                                if (element.changes) {
                                    change = element.changes.find(change => {
                                        if (change.code == code[0]) {
                                            return change
                                        }
                                    })
                                }
                                return new Code(code[0], code[1], element, "imljson", "module", false, change ? change.id : null, code[2])
                            })
                        // Responder
                        case 11:
                            return [
                                [`api`, "Communication", "This specification does inherit from base."],
                                [`parameters`, "Static parameters", "Array of static parameters user can fill while configuring the module. Static parameters can't contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
                                [`expect`, "Mappable parameters", "Array of mappable parameters user can fill while configuring the module. Mappable parameters can contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."]
                            ].map(code => {
                                let change
                                if (element.changes) {
                                    change = element.changes.find(change => {
                                        if (change.code == code[0]) {
                                            return change
                                        }
                                    })
                                }
                                return new Code(code[0], code[1], element, "imljson", "module", false, change ? change.id : null, code[2])
                            })
                    }
                case "rpc":
                    return [
                        [`api`, "Communication", "This specification does inherit from base."],
                        [`parameters`, "Parameters"]
                    ].map(code => {
                        let change
                        if (element.changes) {
                            change = element.changes.find(change => {
                                if (change.code == code[0]) {
                                    return change
                                }
                            })
                        }
                        return new Code(code[0], code[1], element, "imljson", "rpc", false, change ? change.id : null, code[2])
                    })
                case "function":
                    return [
                        [`code`, "Code"],
                        [`test`, "Test"]
                    ].map(code => {
                        let change
                        if (element.changes) {
                            change = element.changes.find(change => {
                                if (change.code == code[0]) {
                                    return change
                                }
                            })
                        }
                        return new Code(code[0], code[1], element, "js", "function", false, change ? change.id : null, code[2])
                    })
            }
        }
    }
}

module.exports = AppsProvider