const EnhancedTreeItem = require('./EnhancedTreeItem');

class Group extends EnhancedTreeItem{
    constructor(id, label, parent, changes){
        super(label + (changes !== undefined ? (changes.length !== 0 ? ` ${EnhancedTreeItem.changedSymbol}` : ""): ""))
        this.id = parent.id+"_"+id
        this.name = id
        this.parent = parent
        this.level = 1
        this.contextValue = id
        this.changes = changes
        this.iconPath = this.makeIconPath(id)
    }
}

module.exports = Group