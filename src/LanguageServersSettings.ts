import * as path from 'node:path';
import * as vscode from 'vscode';
import * as vscodeLanguageclient from 'vscode-languageclient/node';

// Type copied from `jsonServer.ts, which is the receiver of this this datatype.
type ISchemaAssociations = Record<string, string[]>;

/**
 * Gets all JSON schemas definitions specified in this extensions
 * in the `package.json` -> `contributes` -> `jsonValidation`.
 *
 * TODO Convert return into `SchemaConfiguration[]`
 */
export function getJsonSchemas(): ISchemaAssociations {
	const associations: ReturnType<typeof getJsonSchemas> = {};
	const extension = vscode.extensions.getExtension('Integromat.apps-sdk');
	const jsonValidation = extension?.packageJSON?.contributes?.jsonValidation;
	if (extension && Array.isArray(jsonValidation)) {
		jsonValidation.forEach(({ fileMatch, url }) => {
			const fileMatches: string[] = Array.isArray(fileMatch) ? fileMatch : [fileMatch];
			for (let fileMatch of fileMatches) {
				if (url[0] === '.' && url[1] === '/') {
					url = vscode.Uri.file(path.join(extension.extensionPath, url)).toString();
				}
				if (fileMatch[0] === '%') {
					fileMatch = fileMatch.replace(/%APP_SETTINGS_HOME%/, '/User');
					fileMatch = fileMatch.replace(/%APP_WORKSPACES_HOME%/, '/Workspaces');
				} else if (
					typeof fileMatch === 'string' &&
					fileMatch.charAt(0) !== '/' &&
					!fileMatch.match(/\w+:\/\//)
				) {
					fileMatch = '/' + fileMatch;  // TODO Is it needed to add "/"?
				}
				let association = associations[fileMatch];
				if (!association) {
					association = [];
					associations[fileMatch] = association;
				}
				association.push(url);
			}
		});
	}
	return associations;
}

export const clientOptions = {
	documentSelector: [{ scheme: 'file', language: 'imljson' }],
	synchronize: {
		fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc'),
	},
};

export function buildServerOptions(serverModule: string) {
	const debugOptions = {
		execArgv: ['--nolazy', '--inspect=6009'],
	};

	return {
		run: { module: serverModule, transport: vscodeLanguageclient.TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: vscodeLanguageclient.TransportKind.ipc,
			options: debugOptions,
		},
	};
}
