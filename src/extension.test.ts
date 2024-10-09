import * as assert from 'node:assert';
import { after, before, suite } from 'mocha';
import * as tempy from 'tempy';
import * as vscode from 'vscode';
import { testsOnly_getImljsonLanguageClient } from './extension';

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
 * Check the editor if correctly validates errors during the editation.
 *
 * Note: See https://stackoverflow.com/questions/38279920/how-to-open-file-and-insert-text-using-the-vscode-api
 * how to open file
 */
suite('App online file edit validations', () => {
	const filenamesForOnlineEdit = [
		{
			filename: 'parameters.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Incorrect type. Expected "array".',
		},
		{
			filename: 'expect.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Incorrect type. Expected "array".',
		},
		{
			filename: 'interface.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Incorrect type. Expected "array".',
		},
		{
			filename: 'common.imljson',
			expectedLanguage: 'imljson', // TODO It should be `json` only. Fix this issue.
			problematicContent: '[]',
			expectedProblemMessage: 'Incorrect type. Expected "object".',
		},
		{
			filename: 'api.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Property invalidProperty is not allowed.',
		},
		{
			filename: 'samples.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '[]',
			expectedProblemMessage: 'Incorrect type. Expected "object".',
		},
		{
			filename: 'scopes.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '[]',
			expectedProblemMessage: 'Incorrect type. Expected "object".',
		},
		{
			filename: 'scope.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Incorrect type. Expected "array".',
		},
		{
			filename: 'epoch.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Property invalidProperty is not allowed.',
		},
		{
			filename: 'attach.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Property invalidProperty is not allowed.',
		},
		{
			filename: 'detach.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Property invalidProperty is not allowed.',
		},
		{
			filename: 'publish.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Property invalidProperty is not allowed.',
		},
		{
			filename: 'base.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Property invalidProperty is not allowed.',
		},
		{
			filename: 'api-oauth.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Property invalidProperty is not allowed.',
		},
		{
			filename: 'groups.json',
			expectedLanguage: 'json',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Incorrect type. Expected "array".',
		},
		{
			filename: 'makecomapp.json',
			expectedLanguage: 'json',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessages: [
				'Missing property "components".',
				'Missing property "fileVersion".',
				'Missing property "generalCodeFiles".',
				'Missing property "origins".',
				'Property invalidProperty is not allowed.',
			],
		},
	];
	filenamesForOnlineEdit.forEach((def) => {
		suite(`- file "${def.filename}"`, () => {
			let documentUri: vscode.Uri;
			let textDocument: vscode.TextDocument;
			let e: vscode.TextEditor;

			// Create file in temp and open in VSCode editor
			before(async () => {
				documentUri = vscode.Uri.parse(tempy.file({ name: def.filename }));
				await vscode.workspace.fs.writeFile(documentUri, new TextEncoder().encode(''));
				textDocument = await vscode.workspace.openTextDocument(documentUri);
				e = await vscode.window.showTextDocument(textDocument, 1, false);
			});

			// Close file and delete it.
			after(async () => {
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor', documentUri);
				await vscode.workspace.fs.delete(documentUri);
			});

			test(`Should be represented as ${def.expectedLanguage.toUpperCase()} language`, async () => {
				assert.equal(textDocument.languageId, def.expectedLanguage, 'Language ID comparision');
			});

			test('Should detect JSON parse error', async () => {
				await setEditorContentAndWaitForDiagnosticsChange(e, ',');

				const problems = vscode.languages.getDiagnostics(documentUri);
				assert.equal(
					problems?.length,
					1,
					`Must exist exactly 1 problem, but ${problems.length} exists: ` +
						problems.map((problem) => problem.message).join('; '),
				);
				assert.equal(problems?.[0]?.message, 'Expected a JSON object, array or literal.');
			});

			if (def.problematicContent && def.expectedProblemMessage) {
				test('Shlould validate against JSON schema', async () => {
					await setEditorContentAndWaitForDiagnosticsChange(e, def.problematicContent);

					const problems = vscode.languages.getDiagnostics(documentUri);
					assert.equal(
						problems?.length,
						1,
						`Must exist exactly 1 problem, but ${problems.length} exists: ` +
							problems.map((problem) => problem.message).join('; '),
					);
					assert.equal(problems?.[0]?.message, def.expectedProblemMessage);
				});
			}

			if (def.problematicContent && def.expectedProblemMessages) {
				test('Shlould validate against JSON schema', async () => {
					await setEditorContentAndWaitForDiagnosticsChange(e, def.problematicContent);

					const problemsMessages = vscode.languages
						.getDiagnostics(documentUri)
						.map((problem) => problem.message);
					for (const expectedProblemMessage of def.expectedProblemMessages) {
						assert.ok(
							problemsMessages.includes(expectedProblemMessage),
							`Missing the expected validation problem "${expectedProblemMessage}"`,
						);
					}
					assert.equal(
						problemsMessages.length,
						def.expectedProblemMessages.length,
						'Incorrect number of validation problems.',
					);
				});
			}
		});
	});

	// Close all forgotly opened files (but all should be already closed)
	after(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});
});

/**
 * Writes new `content` into and already opened file in VSCode editor
 * and waits for the "problems" section to be updated by background tasks.
 *
 * Note: Expects that "problems" will be changed.
 */
async function setEditorContentAndWaitForDiagnosticsChange(e: vscode.TextEditor, content: string) {
	// Initiate the event listener, which waits to update editor code "problems" list.
	const waitPromise = new Promise<void>((done, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error('onDidChangeDiagnostics timeout. May be no changes in diagnostics.'));
		}, 2000);
		const disposable = vscode.languages.onDidChangeDiagnostics(() => {
			clearTimeout(timeout);
			disposable.dispose();
			done();
		});
	});

	// Change the editor content
	await e.edit((tee) => {
		const doc = e.document;
		tee.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), content);
	});
	return waitPromise;
}
