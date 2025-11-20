import type { VscodeLibWrapperWorkspaceInterface } from '../types';
import { vsCodeLibWrapperFsImplementationForIDE } from './fs';

export const vsCodeLibWrapperWorkspaceImplementationForIDE: VscodeLibWrapperWorkspaceInterface = {
	asRelativePath: () => {
		throw new Error('asRelativePath is not implemented in CLI yet');
	},
	fs: vsCodeLibWrapperFsImplementationForIDE,
};
