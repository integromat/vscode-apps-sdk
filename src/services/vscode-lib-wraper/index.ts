import { ideCliMode } from '../ide-or-cli-mode';
import type { VscodeLibWrapperInterface } from './types';

export const vscodeLibWrapperFactory = {
	get lib(): VscodeLibWrapperInterface {
		const mode = ideCliMode.mode;

		switch (mode) {
			case 'ide':
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				return require('./vscode-ide-modules/index').vscodeLibWrapperImplementationForIDE;

			case 'cli':
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				return require('./vscode-cli-modules/index').vscodeLibWrapperImplementationForCLI;

			default:
				throw new Error(`Unsupported IdeCli environment: ${mode}`);
		}
	},
};
