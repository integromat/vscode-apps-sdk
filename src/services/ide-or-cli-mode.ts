/**
 * Set the environment mode on app start.
 * Note: Cannot be changed after initialization.
 */

/** @private */
let _currentMode: 'ide' | 'cli' | undefined = undefined;

export const ideCliMode = {
	get mode(): 'ide' | 'cli' {
		if (_currentMode === undefined) {
			throw new Error('Mode is not set yet.');
		}
		return _currentMode;
	},
	set mode(mode: 'ide' | 'cli') {
		// Prevent changing mode after initial set
		if (_currentMode !== undefined) {
			throw new Error('Mode has already been set and cannot be changed.');
		}
		_currentMode = mode;
	},
};
