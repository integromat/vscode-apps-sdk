import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
			expectedProblemMessage: 'Incorrect type. Expected one of array, string.',
		},
		{
			filename: 'expect.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Incorrect type. Expected one of array, string.',
		},
		{
			filename: 'interface.imljson',
			expectedLanguage: 'imljson',
			problematicContent: '{"invalidProperty":"someValue"}',
			expectedProblemMessage: 'Incorrect type. Expected one of array, string.',
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
	filenamesForOnlineEdit.forEach((def) => defineCodeFileEditValidationSuite(def));

	// Close all forgotly opened files (but all should be already closed)
	after(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});
});

/**
 * Same as the online-mode suite above, but for the filenames generated by Local Development.
 *
 * Runs for both IMLJSON file extensions, because the `apps-sdk.localDev.defaultJsoncFileExtension`
 * setting lets a project use either. Both must be assigned the `imljson` language (highlighting,
 * hover, formatting) and must bind the very same JSON schemas. This is what proves that
 * `*.iml.jsonc` really wins over the built-in `jsonc` language by the longest-extension match,
 * rather than us just assuming it from the `contributes.languages` manifest entry.
 */
suite('Local development file edit validations', () => {
	/** `'{"invalidProperty":"someValue"}'` and `'[]'` are the same probes as the online-mode suite uses. */
	const INVALID_OBJECT = '{"invalidProperty":"someValue"}';
	const INVALID_ARRAY = '[]';
	const PARAM_WITHOUT_HELP = '[{"name":"foo","type":"text"}]';
	const PROPERTY_NOT_ALLOWED = 'Property invalidProperty is not allowed.';

	function filenamesForLocalDevEdit(fileext: 'iml.json' | 'iml.jsonc'): CodeFileEditValidationDef[] {
		return [
			{
				filename: `my-conn.params.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: 'Incorrect type. Expected one of array, string.',
			},
			{
				filename: `get-things.mappable-params.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: 'Incorrect type. Expected one of array, string.',
			},
			{
				filename: `get-things.interface.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: 'Incorrect type. Expected one of array, string.',
			},
			{
				filename: `get-things.communication.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: PROPERTY_NOT_ALLOWED,
			},
			{
				filename: `get-things.samples.${fileext}`,
				problematicContent: INVALID_ARRAY,
				expectedProblemMessage: 'Incorrect type. Expected "object".',
			},
			{
				filename: `my-conn.scope-list.${fileext}`,
				problematicContent: INVALID_ARRAY,
				expectedProblemMessage: 'Incorrect type. Expected "object".',
			},
			{
				filename: `my-conn.default-scope.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: 'Incorrect type. Expected "array".',
			},
			{
				filename: `my-hook.required-scope.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: 'Incorrect type. Expected "array".',
			},
			{
				filename: `get-things.epoch.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: PROPERTY_NOT_ALLOWED,
			},
			{
				filename: `my-hook.attach.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: PROPERTY_NOT_ALLOWED,
			},
			{
				filename: `my-hook.detach.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: PROPERTY_NOT_ALLOWED,
			},
			{
				filename: `base.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: PROPERTY_NOT_ALLOWED,
			},
			{
				filename: `my-conn.oauth-communication.${fileext}`,
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: PROPERTY_NOT_ALLOWED,
			},
			// The Endpoint codes below are matched by directory-scoped globs, so they must live in
			// an `endpoints/<local id>/` subdirectory to bind their schemas.
			{
				filename: `list-things.communication.${fileext}`,
				subdirs: ['endpoints', 'list-things'],
				problematicContent: INVALID_OBJECT,
				expectedProblemMessage: PROPERTY_NOT_ALLOWED,
			},
			{
				filename: `list-things.input.${fileext}`,
				subdirs: ['endpoints', 'list-things'],
				problematicContent: PARAM_WITHOUT_HELP,
				expectedProblemMessage: 'Missing property "help".',
			},
			{
				filename: `list-things.output.${fileext}`,
				subdirs: ['endpoints', 'list-things'],
				problematicContent: PARAM_WITHOUT_HELP,
				expectedProblemMessage: 'Missing property "help".',
			},
		].map((def) => ({ ...def, expectedLanguage: 'imljson' }));
	}

	for (const fileext of ['iml.json', 'iml.jsonc'] as const) {
		suite(`- extension ".${fileext}"`, () => {
			filenamesForLocalDevEdit(fileext).forEach((def) => defineCodeFileEditValidationSuite(def));
		});
	}

	// Close all forgotly opened files (but all should be already closed)
	after(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});
});

/** One code file to be opened in the editor and checked for its language and validation problems. */
interface CodeFileEditValidationDef {
	filename: string;
	expectedLanguage: string;
	/** Subdirectories to create the file in. Needed by codes whose schema glob is directory-scoped. */
	subdirs?: string[];
	problematicContent?: string;
	/** Use when the content must produce exactly this one validation problem. */
	expectedProblemMessage?: string;
	/** Use when the content must produce exactly this set of validation problems. */
	expectedProblemMessages?: string[];
}

/**
 * Defines the test suite checking that a code file opened in the editor gets the expected language
 * and the expected validation problems from its associated JSON schema.
 */
function defineCodeFileEditValidationSuite(def: CodeFileEditValidationDef): void {
	suite(`- file "${def.filename}"`, () => {
		let documentUri: vscode.Uri;
		let textDocument: vscode.TextDocument;
		let e: vscode.TextEditor;

		// Create file in temp and open in VSCode editor
		before(async () => {
			if (def.subdirs) {
				const dir = path.join(tempy.directory(), ...def.subdirs);
				fs.mkdirSync(dir, { recursive: true });
				documentUri = vscode.Uri.file(path.join(dir, def.filename));
			} else {
				documentUri = vscode.Uri.parse(tempy.file({ name: def.filename }));
			}
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

		const { problematicContent, expectedProblemMessage, expectedProblemMessages } = def;

		if (problematicContent && expectedProblemMessage) {
			test('Shlould validate against JSON schema', async () => {
				await setEditorContentAndWaitForDiagnosticsChange(e, problematicContent);

				const problems = vscode.languages.getDiagnostics(documentUri);
				assert.equal(
					problems?.length,
					1,
					`Must exist exactly 1 problem, but ${problems.length} exists: ` +
						problems.map((problem) => problem.message).join('; '),
				);
				assert.equal(problems?.[0]?.message, expectedProblemMessage);
			});
		}

		if (problematicContent && expectedProblemMessages) {
			test('Shlould validate against JSON schema', async () => {
				await setEditorContentAndWaitForDiagnosticsChange(e, problematicContent);

				const problemsMessages = vscode.languages.getDiagnostics(documentUri).map((problem) => problem.message);
				for (const expected of expectedProblemMessages) {
					assert.ok(
						problemsMessages.includes(expected),
						`Missing the expected validation problem "${expected}"`,
					);
				}
				assert.equal(
					problemsMessages.length,
					expectedProblemMessages.length,
					'Incorrect number of validation problems.',
				);
			});
		}
	});
}

suite('Endpoint api.imljson combined schema validation (online mode)', () => {
	let documentUri: vscode.Uri;
	let textDocument: vscode.TextDocument;
	let e: vscode.TextEditor;

	before(async () => {
		const endpointDir = path.join(tempy.directory(), 'endpoints', 'list-things');
		fs.mkdirSync(endpointDir, { recursive: true });
		documentUri = vscode.Uri.file(path.join(endpointDir, 'api.imljson'));
		await vscode.workspace.fs.writeFile(documentUri, new TextEncoder().encode(''));
		textDocument = await vscode.workspace.openTextDocument(documentUri);
		e = await vscode.window.showTextDocument(textDocument, 1, false);
	});

	after(async () => {
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor', documentUri);
		await vscode.workspace.fs.delete(documentUri);
	});

	test('Endpoint api.imljson flags the `endpoint` directive (combined with endpoint-api.json)', async () => {
		await setEditorContentAndWaitForDiagnosticsChange(e, '{"endpoint":"x"}');

		const problems = vscode.languages.getDiagnostics(documentUri);
		assert.ok(
			problems.some((problem) => problem.message === 'Matches a schema that is not allowed.'),
			`Expected a "not allowed" diagnostic, got: ${problems.map((problem) => problem.message).join('; ')}`,
		);
	});
});

suite('base.imljson timeout directive (online mode)', () => {
	let documentUri: vscode.Uri;
	let textDocument: vscode.TextDocument;
	let e: vscode.TextEditor;

	before(async () => {
		documentUri = vscode.Uri.parse(tempy.file({ name: 'base.imljson' }));
		await vscode.workspace.fs.writeFile(documentUri, new TextEncoder().encode(''));
		textDocument = await vscode.workspace.openTextDocument(documentUri);
		e = await vscode.window.showTextDocument(textDocument, 1, false);
	});

	after(async () => {
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor', documentUri);
		await vscode.workspace.fs.delete(documentUri);
	});

	test('Accepts a timeout within bounds, flags one over the maximum', async () => {
		await setEditorContentAndWaitForDiagnosticsChange(e, '{"timeout":400000}');
		assert.deepStrictEqual(
			vscode.languages.getDiagnostics(documentUri).map((problem) => problem.message),
			['Value is above the maximum of 300000.'],
		);

		await setEditorContentAndWaitForDiagnosticsChange(e, '{"timeout":30000}');
		assert.deepStrictEqual(vscode.languages.getDiagnostics(documentUri), []);
	});
});

suite('inputParameters.imljson derived schema validation (online mode)', () => {
	let documentUri: vscode.Uri;
	let textDocument: vscode.TextDocument;
	let e: vscode.TextEditor;

	before(async () => {
		documentUri = vscode.Uri.parse(tempy.file({ name: 'inputParameters.imljson' }));
		await vscode.workspace.fs.writeFile(documentUri, new TextEncoder().encode(''));
		textDocument = await vscode.workspace.openTextDocument(documentUri);
		e = await vscode.window.showTextDocument(textDocument, 1, false);
	});

	after(async () => {
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor', documentUri);
		await vscode.workspace.fs.delete(documentUri);
	});

	test('Flags a parameter missing `help`', async () => {
		await setEditorContentAndWaitForDiagnosticsChange(e, '[{"name":"foo","type":"text"}]');
		assert.deepStrictEqual(
			vscode.languages.getDiagnostics(documentUri).map((problem) => problem.message),
			['Missing property "help".'],
		);
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
