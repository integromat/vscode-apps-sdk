import type { VscodeLibWrapperWorkspaceInterface } from '../types';
import { vsCodeLibWrapperFsImplementationForCLI } from './fs';

export const vsCodeLibWrapperWorkspaceImplementationForCLI: VscodeLibWrapperWorkspaceInterface = {
	asRelativePath: () => {
		throw new Error('asRelativePath is not implemented in CLI mock');
	},
	fs: vsCodeLibWrapperFsImplementationForCLI,
};
