const vscode = require('vscode')
const path = require('path')

class EnhancedTreeItem extends vscode.TreeItem{
    constructor(label, collapsibleState){
        super(label, collapsibleState !== undefined ? collapsibleState : vscode.TreeItemCollapsibleState.Collapsed)
    }
    
    /**
     * COMMON FUNCTIONS
     */
    makeIconPath(name){
        return {
            dark: path.join(__dirname, '..', '..', "resources", "icons", "dark", `${name}.png`),
            light: path.join(__dirname, '..', '..', "resources", "icons", "light", `${name}.png`)
        }
    }

    static get changedSymbol() { return "*"}
    static get privateSymbol() { return "" }
    static get publicSymbol() { return "∴" }
    static get approvedSymbol(){ return "✔"}
}

module.exports = EnhancedTreeItem