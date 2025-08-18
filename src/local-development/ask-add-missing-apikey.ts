import * as vscode from 'vscode';
import type { LocalAppOrigin } from './types/makecomapp.types';
import { downloadComponentCode } from './code-pull-deploy';
import { getConfiguration } from '../providers/configuration';
import { withProgressDialog } from '../utils/vscode-progress-dialog';

/**
 * User is asked for an API token (if secret file is missing in origin configuration).
 * After entering/selecting the API token, this token is written to `.secrets` file.
 *
 * User can select the API token from existing extension's evironments or enter own one manually.
 *
 * @return API token
 */
export async function askAddMissingApiKey(origin: LocalAppOrigin, makeappRootdir: vscode.Uri): Promise<string> {
	if (!origin.apikeyFile) {
		throw new Error(
			`Cannot set new API token to origin "${
				origin.label ?? origin.appId
			}", because the property "makecomapp.json -> origins[?] -> apikeyFile" is missing. This inconsistency is not supported. Resolve this issue by manual edit of "makecomapp.json" file.`,
		);
	}

	let selectedApiKey: string;
	let isTokenValid: boolean;
	do {
		// Ask user for API token
		selectedApiKey = await askApiKey(origin);

		// Test the origin connection with newly entered API token
		try {
			isTokenValid = await withProgressDialog(
				{ title: `Testing new API token with remote origin "${origin.label || origin.appId}"` },
				async () => {
					return testConnection(selectedApiKey, origin);
				},
			);
		} catch (err: any) {
			const answer = await vscode.window.showWarningMessage(
				'',
				{
					modal: true,
					detail: `${err.message}. Do you want to save and use your API token anyway?`,
				},
				{ title: 'Save & Use API token' },
			);
			if (answer?.title === 'Save & Use API token') {
				isTokenValid = true;
			} else {
				throw new Error('Cancelled by user.');
			}
		}
		if (!isTokenValid) {
			await vscode.window.showErrorMessage('API token not valid', {
				modal: true,
				detail: `Entered API token is not valid. Connection to remote origin "${
					origin.label || origin.appId
				}" failed. Try with another API token.`,
			});
		}
	} while (!isTokenValid);

	// Write new API token to file
	const apikeyFile = vscode.Uri.joinPath(makeappRootdir, origin.apikeyFile);
	await vscode.workspace.fs.writeFile(apikeyFile, new TextEncoder().encode(selectedApiKey));

	await vscode.window.showInformationMessage('API token saved', {
		modal: true,
		detail: `API token saved into file "${vscode.workspace.asRelativePath(apikeyFile)}".`,
	});

	return selectedApiKey;
}

/**
 * Selection dialog, where user can select one of tokens entered in the extension's environments,
 * or user can enter the API token manually.
 * @return API token
 * @private Helper function for `askAddMissingApiKey()`
 */
async function askApiKey(origin: LocalAppOrigin): Promise<string> {
	const configuration = getConfiguration();

	const specialAnswers = {
		ENTER_OWN_APIKEY: Symbol('Enter custom API token'),
	};

	// Prepare dialog options
	const pickOptions: (vscode.QuickPickItem & { apikey: string | symbol; order: number })[] = [
		// Offer all existing suitable counterparty components
		...configuration.environments.map((makeEnvironment) => ({
			label: `Use API token from "${makeEnvironment.name}" environment${
				configuration.environment === makeEnvironment.uuid ? ' [current]' : ''
			}`,
			apikey: makeEnvironment.apikey,
			order: configuration.environment === makeEnvironment.uuid ? 0 : 1,
		})),
		// and offer to enter API token manually
		{
			label: String(specialAnswers.ENTER_OWN_APIKEY.description),
			apikey: specialAnswers.ENTER_OWN_APIKEY,
			order: 2,
		},
	];
	// Display the current environment as first
	pickOptions.sort((obj1, obj2) => obj1.order - obj2.order);

	const selectedEnv = await vscode.window.showQuickPick<(typeof pickOptions)[0]>(pickOptions, {
		ignoreFocusOut: true,
		title: `Required API token file is missing for origin "${origin.label || origin.appId}". What to do?`,
	});

	if (!selectedEnv) {
		throw new Error('Cancelled by used.');
	}

	if (typeof selectedEnv.apikey === 'symbol') {
		switch (selectedEnv.apikey) {
			case specialAnswers.ENTER_OWN_APIKEY:
				return askCustomApiKey(origin);
			default:
				throw new Error('Internal error. Unknown answer in askAddMissingApiKey()');
		}
	} else {
		return selectedEnv.apikey;
	}
}

/**
 * Input dialog, where user enters the API token.
 * @return API token
 * @private Helper function for `askApiKey()`
 */
async function askCustomApiKey(origin: LocalAppOrigin): Promise<string> {
	const apiKey = await vscode.window.showInputBox({
		title: `API token for origin "${origin.label || origin.appId}"`,
		prompt: 'Enter API token, which should be used & stored:',
		ignoreFocusOut: true,
		placeHolder: 'Example: 12345678-90ab-cdef-1234-1234567890ab',
		validateInput: (value) => {
			if (value === '') {
				return 'Fill or paste the API token.';
			}
			const uuidRegExp = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
			if (!uuidRegExp.test(value)) {
				return 'Your API token is incomplete, or has invalid format';
			}
		},
	});
	if (!apiKey) {
		throw new Error('Cancelled by user.');
	}
	return apiKey;
}

/**
 * Tries to download app's readme to resolve if API token is valid or not
 * @return True if token is valid.
 */
async function testConnection(apiKey: string, origin: LocalAppOrigin): Promise<boolean> {
	try {
		// Validate the API token
		await downloadComponentCode({
			appComponentType: 'app',
			codeType: 'readme',
			origin: { ...origin, apikey: apiKey },
			remoteComponentName: '',
		});
		return true;
	} catch (err: any) {
		if (err.message.includes('Access denied')) {
			// Valid API response, but the API token is not valid.
			return false;
		} else {
			// Unexpected API response or error
			throw new Error(`Failed to test connection to origin ${origin.label || origin.appId}. ${err}`, {
				cause: err,
			});
		}
	}
}
