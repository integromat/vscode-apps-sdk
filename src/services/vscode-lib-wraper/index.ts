import type { VscodeLibWrapperInterface } from './types';

class VscodeLibWraperFactory {
	private _library: VscodeLibWrapperInterface | undefined; // Todo define interface for both vscode and cli

	public setMode(mode: 'ide' | 'cli') {
		switch (mode) {
			case 'ide':
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				this._library = require('./vscode-ide-modules/index').vscodeLibWrapperImplementationForIDE;
				break;

			case 'cli':
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				this._library = require('./vscode-cli-modules/index').vscodeLibWrapperImplementationForCLI;
				break;

			default:
				throw new Error(`Unsupported VscodeLibWraper environment: ${mode}`);
		}
	}

	public get lib(): VscodeLibWrapperInterface {
		if (!this._library) {
			throw new Error('VscodeLibWraper library is not initialized. Call setMode() first.');
		}
		return this._library;
	}
}

/**
 * This is the singleton instance, which is designed
 * to be used in `src/local-development/**` instead of direct `vscode` import.
 */
export const vscodeLibWrapperFactory = new VscodeLibWraperFactory();
