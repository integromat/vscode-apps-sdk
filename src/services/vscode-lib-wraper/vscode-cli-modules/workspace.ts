
export const vsCodeLibWrapperWorkspaceImplementationForCLI = {
	asRelativePath: (() => {
		throw new Error('asRelativePath is not implemented in CLI mock');
	}),
	fs: vsCodeLibWrapperFsImplementationForCLI,
};
