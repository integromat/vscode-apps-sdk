import * as vscode from 'vscode';
import axios from 'axios';

import * as Core from '../Core';
import * as Enum from '../Enum';
import * as Meta from '../Meta';
import { showError } from '../error-handling';
import AppsProvider from '../providers/AppsProvider';
import { Environment } from '../types/environment.types';

export class CommonCommands {

	static async register(appsProvider: AppsProvider, _authorization: string, _environment: Environment): Promise<void> {

		/**
		 * Delete entity
		 */
		vscode.commands.registerCommand('apps-sdk.delete', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return; }
			const app = context.parent.parent;

			// Wait for confirmation
			const answer = await vscode.window.showQuickPick(Enum.delete, { placeHolder: `Do you really want to delete the ${context.supertype} ${context.bareLabel} (ID ${context.name}) ?` });

			// If not confirmed, cancel
			if (answer?.label !== 'Yes') {
				return;
			}

			// Set URI and send the request
			context.apiPath = context.apiPath === undefined ? context.supertype : context.apiPath;
			const url = Core.isVersionable(context.apiPath) ?
				`${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${app.name}/${app.version}/${Core.pathDeterminer(_environment.version, context.apiPath)}/${context.name}` :
				`${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${Core.pathDeterminer(_environment.version, context.apiPath)}/${context.name}`;
			try {
				// Delete the entity
				await axios({
					method: 'DELETE',
					url: url,
					headers: {
						Authorization: _authorization,
						'x-imt-apps-sdk-version': Meta.version
					},
				});
				appsProvider.refresh();
			}
			catch (err: any) {
				showError(err, 'apps-sdk.delete');
			}
		});

		/**
		 * Refresh
		 */
		vscode.commands.registerCommand('apps-sdk.refresh', function () {
			appsProvider.refresh();
		});
	}
}
