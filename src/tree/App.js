/* eslint-disable semi,@typescript-eslint/no-var-requires */
const path = require('path')
const EnhancedTreeItem = require('./EnhancedTreeItem')
const { appsIconTempDir } = require('../temp-dir');

class App extends EnhancedTreeItem {
	constructor(name, label, description, version, isPublic, isApproved, theme, changes, iconVersion, isOpensource  = false) {
		super(
			label
			+ (changes?.length !== 0 ? ` ${EnhancedTreeItem.changedSymbol}` : "")
			+ (version > 1 ? ` (version ${version})` : "")
		)
		this.bareLabel = label
		this.id = `${name}@${version}`
		this.name = name
		this.description = description || ''
		this.version = version
		this.public = isPublic
		this.approved = isApproved
		this.level = 0
		this.contextValue = "app"
			+ (isApproved ? "_approved" : "")
			+ (!isApproved && isPublic ? "_public" : "")
			+ (changes?.length !== 0 ? "_changed" : "");
		this.theme = theme
		/** Defines the final png icon filename. */
		this.iconVersion = iconVersion;
		this.changes = changes
		/** Is the app opensource? If app is opensource, then green square is not added to icon.  */
		this.isOpensource = isOpensource;
		this.tooltip = this.makeTooltip()
		this.iconPath = this.makeIconPath();
		this.rawIcon = {
			dark: path.join(appsIconTempDir, `${this.name}.${this.iconVersion}.png`),
			light: path.join(appsIconTempDir, `${this.name}.${this.iconVersion}.dark.png`)
		}
	}

	/**
	 * Get path to icon file.
	 * If appp is public, then used public icon (it means icon with small green square in right bottom corner).
	 * @param {string} iconDir Basedir of icons.
	 * @returns {string}
	 */
	makeIconPath() {
		if (!this.public || this.isOpensource) {
			return {
				dark: path.join(appsIconTempDir, `${this.name}.${this.iconVersion}.png`),
				light: path.join(appsIconTempDir, `${this.name}.${this.iconVersion}.dark.png`)
			}
		}
		else {
			return {
				dark: path.join(appsIconTempDir, `${this.name}.${this.iconVersion}.public.png`),
				light: path.join(appsIconTempDir, `${this.name}.${this.iconVersion}.dark.public.png`)
			}
		}
	}
	makeTooltip() {
		let tooltip = `${this.bareLabel}
-----------------------
ID (Name): ${this.name}
Description: ${this.description}
Theme: ${this.theme}
Version: ${this.version}
Public: ${this.public}
Approved: ${this.approved}`;

		return tooltip
	}
}

module.exports = App
