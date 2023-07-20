const path = require('path')
const EnhancedTreeItem = require('./EnhancedTreeItem')

class App extends EnhancedTreeItem {
	constructor(name, label, description, version, isPublic, isApproved, iconDir, theme, changes, iconVersion, isOpensource  = false) {
		super(label + (changes !== undefined ? (changes.length !== 0 ? ` ${EnhancedTreeItem.changedSymbol}` : "") : "") + (version > 1 ? ` (version ${version})` : ""))
		this.bareLabel = label
		this.id = `${name}@${version}`
		this.name = name
		this.description = description || ''
		this.version = version
		this.public = isPublic
		this.approved = isApproved
		this.level = 0
		this.contextValue = "app" + (this.approved ? "_approved" : this.public ? "_public" : "") + (changes !== undefined ? (changes.length !== 0 ? "_changed" : "") : "")
		this.theme = theme
		this.iconVersion = iconVersion
		this.changes = changes
		this.tooltip = this.makeTooltip()
		this.iconPath = this.makeIconPath(iconDir, isOpensource);
		this.rawIcon = {
			dark: path.join(iconDir, `${this.name}.${this.iconVersion}.png`),
			light: path.join(iconDir, `${this.name}.${this.iconVersion}.dark.png`)
		}
	}

	/**
	 * Get path to icon file.
	 * @param {string} iconDir Basedir of icons.
	 * @param {boolean} isOpensource Is the app opensource?
	 * @returns {string}
	 */
	makeIconPath(iconDir, isOpensource) {
		if (!this.public || isOpensource) {
			return {
				dark: path.join(iconDir, `${this.name}.${this.iconVersion}.png`),
				light: path.join(iconDir, `${this.name}.${this.iconVersion}.dark.png`)
			}
		}
		else {
			return {
				dark: path.join(iconDir, `${this.name}.${this.iconVersion}.public.png`),
				light: path.join(iconDir, `${this.name}.${this.iconVersion}.dark.public.png`)
			}
		}
	}
	makeTooltip() {
		let tooltip = `${this.bareLabel}
-----------------------
Name: ${this.name}
Description: ${this.description}
Theme: ${this.theme}
Version: ${this.version}
Public: ${this.public}
Approved: ${this.approved}`
		return tooltip
	}
}

module.exports = App
