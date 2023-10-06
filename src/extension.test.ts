import * as assert from 'node:assert';
import { after, suite } from 'mocha';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { testsOnly_getImljsonLanguageClient } from './extension';

// import * as myExtension from '../../extension';   // Example

suite('Extension Intialization Tests', () => {
	vscode.window.showInformationMessage('Running e2e/unit testing ...');

	test('Extension is present and has correct ID', () => {
		assert.ok(vscode.extensions.getExtension('Integromat.apps-sdk'));
	});

	test('Extension can be activated', async () => {
		await vscode.extensions.getExtension('Integromat.apps-sdk')?.activate();
		assert.ok(vscode.extensions.getExtension('Integromat.apps-sdk')?.isActive);
	}).timeout(5000);

	test('IMLJSON language exists', async () => {
		const languages = await vscode.languages.getLanguages();
		assert.ok(languages.includes('imljson'), `Languages are only: ${languages.join(', ')}`);
	});

	test('IMLJSON language server is running', () => {
		const imljsonLanguageClient = testsOnly_getImljsonLanguageClient();
		assert.equal(imljsonLanguageClient?.name, 'IMLJSON language server', 'Unexpected IMLJSON language server name');
		assert.equal(imljsonLanguageClient?.isRunning(), true);
	});
});

/**
 * See https://stackoverflow.com/questions/38279920/how-to-open-file-and-insert-text-using-the-vscode-api
 * how to open file
 */
suite('Language ID tests for files used by online edits', () => {
	const filenamesForOnlineEdit = [
		{ filename: 'parameters.imljson', language: 'imljson' },
		{ filename: 'expect.imljson', language: 'imljson' },
		{ filename: 'interface.imljson', language: 'imljson' },
		{ filename: 'common.imljson', language: 'imljson' },  // TODO It should be `json` only. Fix this issue.
		{ filename: 'api.imljson', language: 'imljson' },
		{ filename: 'samples.imljson', language: 'imljson' },
		{ filename: 'scopes.imljson', language: 'imljson' },
		{ filename: 'scope.imljson', language: 'imljson' },
		{ filename: 'epoch.imljson', language: 'imljson' },
		{ filename: 'attach.imljson', language: 'imljson' },
		{ filename: 'detach.imljson', language: 'imljson' },
		{ filename: 'publish.imljson', language: 'imljson' },
		{ filename: 'base.imljson', language: 'imljson' },
		{ filename: 'api-oauth.imljson', language: 'imljson' },
		{ filename: 'groups.json', language: 'json' },
	];
	for (const def of filenamesForOnlineEdit) {
		test(`File ${def.filename} language should be ${def.language.toUpperCase()}`, async () => {
			const textDocument = await vscode.workspace.openTextDocument(vscode.Uri.parse('untitled:' + def.filename));
			// const e = await vscode.window.showTextDocument(a, 1, false);
			// e.edit((edit) => { edit.insert(new vscode.Position(0, 0), '{}'); });
			assert.equal(textDocument.languageId, def.language, 'Language ID comparision');
		});
	}

	after(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});
});
