const EnhancedTreeItem = require('./EnhancedTreeItem');

class Item extends EnhancedTreeItem {
	constructor(id, label, parent, supertype, type, isPublic, isApproved, changes, description, crud) {
		let temp = label
		label = temp + (changes !== undefined ? (changes.length !== 0 ? ` ${EnhancedTreeItem.changedSymbol}` : "") : "")
		if (supertype === "module") {
			label += (isPublic ? (isApproved ? ` ${EnhancedTreeItem.approvedSymbol}` : ` ${EnhancedTreeItem.publicSymbol}`) : "")
		}
		if (supertype === "connection") {
			label += ` (${type})`
		}
		super(label)
		this.bareLabel = temp
		this.id = parent.id + "_" + id
		this.name = id
		this.parent = parent
		this.supertype = supertype
		this.type = type
		this.level = 2
		this.public = isPublic
		this.approved = isApproved
		this.contextValue = supertype + (this.approved ? "_approved" : this.public ? "_public" : "")
		this.changes = changes
		this.tooltip = description || label
		this.crud = crud
		this.iconPath = this.makeIconPath(this.supertype)
	}
}

module.exports = Item