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
            let response = await Core.rpGet(`${this._baseUrl}/app`, this._authorization)
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
                    apps.push(new App(app.name, app.label, app.version, app.public, app.approved, iconDir, app.theme, app.changes))
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
                switch(group[0]){
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
                    if (change.group === groupItem){
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
                    [`base`, "Base"],
                    [`common`, "Common"]
                ].map(code => {
                    let change = element.changes.find(change => {
                        if(change.code == code[0]){
                            return change
                        }
                    })
                    return new Code(code[0], code[1], element, "imljson", "app", false,  change ? change.id : null)
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
            else{
                for(let needle of ["connections", "webhooks", "modules", "rpcs", "functions"]){
                    if(element.id.includes(needle)){
                        let name = needle.slice(0, -1);
                        let uri = ["connection", "webhook"].includes(name) ?
                            `${this._baseUrl}/app/${element.parent.name}/${name}` :
                            `${this._baseUrl}/app/${element.parent.name}/${element.parent.version}/${name}`
                        let connections = await Core.rpGet(uri, this._authorization)
                        return connections.map(item => {
                            let changes = element.changes.filter(change => {
                                if(change.item === item.name){
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
            switch(element.supertype){
                case "connection":
                    return [
                        [`api`, "Communication"],
                        [`common`, "Common data"],
                        [`scopes`, "Scope list"],
                        [`scope`, "Default scope"],
                        [`parameters`, "Parameters"]
                    ].map(code => {
                        let change
                        if(element.changes){
                            change = element.changes.find(change => {
                                if(change.code == code[0]){
                                    return change
                                }
                            })
                        }
                        return new Code(code[0], code[1], element, "imljson", "connection", false, change ? change.id : null)
                    })
                case "webhook":
                    return [
                        [`api`, "Communication"],
                        [`parameters`, "Parameters"],
                        [`attach`, "Attach"],
                        [`detach`, "Detach"],
                        [`scope`, "Required scope"]
                    ].map(code => {
                        let change
                        if(element.changes){
                            change = element.changes.find(change => {
                                if(change.code == code[0]){
                                    return change
                                }
                            })
                        }
                        return new Code(code[0], code[1], element, "imljson", "webhook", false, change ? change.id : null)
                    })
                case "module":
                    switch(element.type){
                        // Action or search
                        case 4:
                        case 9:
                            return [
                                [`api`, "Communication"],
                                [`parameters`, "Static parameters"],
                                [`expect`, "Mappable parameters"],
                                [`interface`, "Interface"],
                                [`samples`, "Samples"],
                                [`scope`, "Scope"]
                            ].map(code => {
                                let change
                                if(element.changes){
                                    change = element.changes.find(change => {
                                        if(change.code == code[0]){
                                            return change
                                        }
                                    })
                                }
                                return new Code(code[0], code[1], element, "imljson", "module", false, change ? change.id : null)
                            })
                        // Trigger
                        case 1:
                            return [
                                [`api`, "Communication"],
                                [`epoch`, "Epoch"],
                                [`parameters`, "Static parameters"],
                                [`interface`, "Interface"],
                                [`samples`, "Samples"],
                                [`scope`, "Scope"]
                            ].map(code => {
                                let change
                                if(element.changes){
                                    change = element.changes.find(change => {
                                        if(change.code == code[0]){
                                            return change
                                        }
                                    })
                                }
                                return new Code(code[0], code[1], element, "imljson", "module", false, change ? change.id : null)
                            })
                        // Instant trigger
                        case 10:
                            return [
                                [`api`, "Communication"],
                                [`parameters`, "Static parameters"],
                                [`interface`, "Interface"],
                                [`samples`, "Samples"]
                            ].map(code => {
                                let change
                                if(element.changes){
                                    change = element.changes.find(change => {
                                        if(change.code == code[0]){
                                            return change
                                        }
                                    })
                                }
                                return new Code(code[0], code[1], element, "imljson", "module", false, change ? change.id : null)
                            })
                        // Responder
                        case 11:
                            return [
                                [`api`, "Communication"],
                                [`parameters`, "Static parameters"],
                                [`expect`, "Mappable parameters"]
                            ].map(code => {
                                let change
                                if(element.changes){
                                    change = element.changes.find(change => {
                                        if(change.code == code[0]){
                                            return change
                                        }
                                    })
                                }
                                return new Code(code[0], code[1], element, "imljson", "module", false, change ? change.id : null)
                            })
                    }
                case "rpc": 
                    return [
                        [`api`, "Communication"],
                        [`parameters`, "Parameters"]
                    ].map(code => {
                        let change
                        if(element.changes){
                            change = element.changes.find(change => {
                                if(change.code == code[0]){
                                    return change
                                }
                            })
                        }
                        return new Code(code[0], code[1], element, "imljson", "rpc", false, change ? change.id : null)
                    })
                case "function":
                    return [
                        [`code`, "Code"]
                    ].map(code => {
                        let change
                        if(element.changes){
                            change = element.changes.find(change => {
                                if(change.code == code[0]){
                                    return change
                                }
                            })
                        }
                        return new Code(code[0], code[1], element, "js", "function", false, change ? change.id : null)
                    })
            }
        }
    }
}

module.exports = AppsProvider