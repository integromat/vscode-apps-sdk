const path = require('path')
const EnhancedTreeItem = require('./EnhancedTreeItem');

class App extends EnhancedTreeItem {
    constructor(name, label, version, isPublic, isApproved, iconDir, theme, changes, rand) {
        super(label + (changes !== undefined ? (changes.length !== 0 ? ` ${EnhancedTreeItem.changedSymbol}` : "") : "") + (isPublic ? (isApproved ? ` ${EnhancedTreeItem.approvedSymbol}` : ` ${EnhancedTreeItem.publicSymbol}`) : ""))
        this.bareLabel = label
        this.id = name
        this.name = name
        this.version = version
        this.public = isPublic
        this.approved = isApproved
        this.level = 0
        this.contextValue = "app" + (changes !== undefined ? (changes.length !== 0 ? "_changed" : "") : "")
        this.theme = theme
        this.changes = changes
        this.rand = rand
        this.iconPath = this.makeIconPath(iconDir)
    }
    makeIconPath(iconDir) {
        return {
            dark: path.join(iconDir, `${this.name}_${this.rand}.png`),
            light: path.join(iconDir, `${this.name}_${this.rand}_d.png`)
        }
    }
}

module.exports = App