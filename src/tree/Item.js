/* eslint-disable semi,@typescript-eslint/no-var-requires */
const EnhancedTreeItem = require('./EnhancedTreeItem');
const { translateModuleTypeId } = require('../services/module-types-naming');

class Item extends EnhancedTreeItem {
	constructor(id, label, parent, supertype, type, isPublic, isApproved, changes, description, crud) {
		let temp = label
		label = temp + (changes !== undefined ? (changes.length !== 0 ? ` ${EnhancedTreeItem.changedSymbol}` : "") : "")
		if (supertype === "module") {
			/* TODO is this needed? */
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
		this.bareDescription = description
		this.crud = crud
		this.tooltip = this.makeTooltip(label, description) || description || label
		this.iconPath = this.makeIconPath(this.supertype, (this.public && !this.isAppOpensource) ? ".public" : "");
	}

	makeTooltip() {
		if (this.supertype !== "module") { return undefined; }
		let tooltip = `${this.bareLabel}\r\n-----------------------\r\nName: ${this.name}\r\nType: ${
			translateModuleTypeId(this.type)
		}\r\n`;
		if (this.type === 4) {
			tooltip += `CRUD type: ${this.crud || "multipurpose"}\r\n`
		}
		if (this.bareDescription) {
			tooltip += `Description: ${this.bareDescription}\r\n`
		}
		tooltip += `Public: ${this.public}\r\nApproved: ${this.approved}`
		return tooltip
	}

	/**
	 * @return True, if app (parent of this item) is example (formerly Opensource).
	 *         False for regular user's app.
	 */
	get isAppOpensource()/*:boolean */ {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let app/*:EnhancedTreeItem*/ = this;
		while (app.parent) { app = app.parent; }
		return app.isOpensource ;
	}
}

module.exports = Item
