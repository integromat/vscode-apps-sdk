/**
 * Set the environment mode on app start.
 * Note: Cannot be changed after initialization.
 */

/** @private */
let _currentMode: 'ide' | 'cli' | undefined = undefined;

let alreadyReaded = false;

export const ideCliMode = {
	get mode(): 'ide' | 'cli' {
		if (_currentMode === undefined) {
			throw new Error('Mode is not set yet.');
		}
		alreadyReaded = true;
		return _currentMode;
	},
	set mode(mode: 'ide' | 'cli') {
		// Prevent changing mode after some module already read the mode.
		if (alreadyReaded) {
			throw new Error(
				'Application fatal error: Mode has already been set and cannot be changed. This is a nodejs modules import order issue. Rearrange the imports to fix this.',
			);
		}
		// Prevent changing mode after initial set
		if (_currentMode !== undefined) {
			throw new Error('Mode has already been set and cannot be changed.');
		}
		_currentMode = mode;
	},
};
