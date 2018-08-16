const EnhancedTreeItem = require('./EnhancedTreeItem');

class Code extends EnhancedTreeItem{
    constructor(id, label, parent, language, apiPath, readonly, change){
        super(label + (change ? ` ${EnhancedTreeItem.changedSymbol}` : ""), 0)
        this.id = parent.id+"_"+id
        this.name = id
        this.apiPath = apiPath
        this.parent = parent
        this.language = language
        this.change = change
        if(change){
            this.contextValue = "changed"
        }
        this.command = {
            command: readonly ? "apps-sdk.load-open-source" : "apps-sdk.load-source",
            arguments: [this]
        }
        this.iconPath = this.makeIconPath(this.name)
    }
}

module.exports = Code