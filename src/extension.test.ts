import * as assert from 'node:assert';
import { suite } from 'mocha';
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

	test('IMLJSON language exists', async() => {
		const languages = await vscode.languages.getLanguages();
		assert.ok(languages.includes('imljson'), `Languages are only: ${languages.join(', ')}`);
	});

	test('IMLJSON language server is running', () => {
		const imljsonLanguageClient = testsOnly_getImljsonLanguageClient();
		assert.equal(imljsonLanguageClient?.name, 'IMLJSON language server', 'Unexpected IMLJSON language server name');
		assert.equal(imljsonLanguageClient?.isRunning(), true);
	});
});
