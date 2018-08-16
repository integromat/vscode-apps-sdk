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
    constructor(_authorization, _baseUrl) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._authorization = _authorization
        this._baseUrl = _baseUrl
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
            let response = await Core.rpGet(`${this._baseUrl}/app`, this._authorization, { opensource: true })
            if (response === undefined){ return }
            let iconDir = path.join(tempy.directory(), "icons")
            mkdirp(iconDir)
            let apps = response.map(async (app) => {
                let dest = path.join(iconDir, `${app.name}.png`)
                try{
                    await download.image({
                    headers: {
                        "Authorization": this._authorization
                    },
                    url: `${this._baseUrl}/app/${app.name}/icon/512`,
                    dest: dest
                    })
                    await Core.invertPngAsync(dest);
                }
                catch(err){
                    // Icon doesn't exist -> it has not been set yet
                }
                finally{
                    apps.push(new App(app.name, app.label, app.version, app.public, app.approved, iconDir, app.theme))
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
            return [
                new Group(`general`, "General", element),
                new Group(`connections`, "Connections", element),
                new Group(`webhooks`, "Webhooks", element),
                new Group(`modules`, "Modules", element),
                new Group(`rpcs`, "Remote procedures", element),
                new Group(`functions`, "IML functions", element),
                new Group(`docs`, "Docs", element)
            ]
        }
        /*
         * LEVEL 2 - ITEM OR CODE
         */
        else if (element.level === 1) {
            // General
            if (element.id.includes("general")) {
                return [
                    new Code(`base`, "Base", element, "imljson", "app", true),
                    new Code(`common`, "Common", element, "imljson", "app", true)
                ]
            }
            // Docs
            else if (element.id.includes("docs")) {
                return [
                    new Code(`docs`, "Content", element, "md", "app", true),
                    new Code(`images`, "Images", element, "img", true)
                ]
            }
            // REST
            else{
                for(let needle of ["connections", "webhooks", "modules", "rpcs", "functions"]){
                    if(element.id.includes(needle)){
                        let name = needle.slice(0, -1);
                        let uri = ["connection", "webhook"].includes(name) ?
                            `${this._baseUrl}/app/${element.parent.name}/${name}` :
                            `${this._baseUrl}/app/${element.parent.name}/${element.parent.version}/${name}`
                        let connections = await Core.rpGet(uri, this._authorization)
                        return connections.map(item => new Item(item.name, item.label || (item.name + item.args), element, name, item.type || item.type_id, item.public, item.approved))
                    }
                }
            }
        }
        /*
         * LEVEL 3 - CODE
         */
        else if (element.level === 2) {
            switch(element.supertype){
                case "connection":
                    return [
                        new Code(`api`, "Communication", element, "imljson", "connection", true),
                        new Code(`common`, "Common data", element, "imljson", "connection", true),
                        new Code(`scopes`, "Scope list", element, "imljson", "connection", true),
                        new Code(`scope`, "Default scope", element, "imljson", "connection", true),
                        new Code(`parameters`, "Parameters", element, "imljson", "connection", true)
                    ]
                case "webhook":
                    return [
                        new Code(`api`, "Communication", element, "imljson", "webhook", true),
                        new Code(`parameters`, "Parameters", element, "imljson", "webhook", true),
                        new Code(`attach`, "Attach", element, "imljson", "webhook", true),
                        new Code(`detach`, "Detach", element, "imljson", "webhook", true),
                        new Code(`scope`, "Required scope", element, "imljson", "webhook", true),
                    ]
                case "module":
                    switch(element.type){
                        // Action or search
                        case 4:
                        case 9:
                            return [
                                new Code(`api`, "Communication", element, "imljson", "module", true),
                                new Code(`parameters`, "Static parameters", element, "imljson", "module", true),
                                new Code(`expect`, "Mappable parameters", element, "imljson", "module", true),
                                new Code(`interface`, "Interface", element, "imljson", "module", true),
                                new Code(`samples`, "Samples", element, "imljson", "module", true),
                                new Code(`scope`, "Scope", element, "imljson", "module", true),
                            ]
                        // Trigger
                        case 1:
                            return [
                                new Code(`api`, "Communication", element, "imljson", "module", true),
                                new Code(`epoch`, "Epoch", element, "imljson", "module", true),
                                new Code(`parameters`, "Static parameters", element, "imljson", "module", true),
                                new Code(`interface`, "Interface", element, "imljson", "module", true),
                                new Code(`samples`, "Samples", element, "imljson", "module", true),
                                new Code(`scope`, "Scope", element, "imljson", "module", true),
                            ]
                        // Instant trigger
                        case 10:
                            return [
                                new Code(`api`, "Communication", element, "imljson", "module", true),
                                new Code(`parameters`, "Static parameters", element, "imljson", "module", true),
                                new Code(`expect`, "Interface", element, "imljson", "module", true),
                                new Code(`samples`, "Samples", element, "imljson", "module", true)
                            ]
                        // Responder
                        case 11:
                            return [
                                new Code(`api`, "Communication", element, "imljson", "module", true),
                                new Code(`parameters`, "Static parameters", element, "imljson", "module", true),
                                new Code(`expect`, "Mappable parameters", element, "imljson", "module", true)
                            ]
                    }
                case "rpc": 
                    return [
                        new Code(`api`, "Communication", element, "imljson", "rpc", true),
                        new Code(`parameters`, "Parameters", element, "imljson", "rpc", true)
                    ]
                case "function":
                    return [
                        new Code(`code`, "Code", element, "js", "function", true)
                    ]
            }
        }
    }
}

module.exports = AppsProvider