const path = require('path')
const EnhancedTreeItem = require('./EnhancedTreeItem');

class App extends EnhancedTreeItem {
	constructor(name, label, version, isPublic, isApproved, iconDir, theme, changes, iconVersion) {
		super(label + (changes !== undefined ? (changes.length !== 0 ? ` ${EnhancedTreeItem.changedSymbol}` : "") : "") + (isPublic ? (isApproved ? ` ${EnhancedTreeItem.approvedSymbol}` : ` ${EnhancedTreeItem.publicSymbol}`) : ""))
		this.bareLabel = label
		this.id = name
		this.name = name
		this.version = version
		this.public = isPublic
		this.approved = isApproved
		this.level = 0
		this.contextValue = "app" + (this.approved ? "_approved" : this.public ? "_public" : "") + (changes !== undefined ? (changes.length !== 0 ? "_changed" : "") : "")
		this.theme = theme
		this.iconVersion = iconVersion
		this.changes = changes
		this.tooltip = this.makeTooltip()
		this.iconPath = this.makeIconPath(iconDir)
	}
	makeIconPath(iconDir) {
		return {
			dark: path.join(iconDir, `${this.name}.${this.iconVersion}.png`),
			light: path.join(iconDir, `${this.name}.${this.iconVersion}.dark.png`)
		}
	}
	makeTooltip() {
		let tooltip = `${this.bareLabel}
-----------------------
Name: ${this.name}
Theme: ${this.theme}
Version: ${this.version}
Public: ${this.public}
Approved: ${this.approved}`
		return tooltip
	}
}

module.exports = App