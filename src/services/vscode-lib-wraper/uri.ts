const { URI } = require('monaco-editor/esm/vs/base/common/uri');

// Similar to `vscode.Uri` but compatible with both VSCode and CLI environments.
export const VsCodeWrapperUri = URI;
