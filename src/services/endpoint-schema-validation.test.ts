import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { suite, test } from 'mocha';
import { getLanguageService, TextDocument, type LanguageService, type SchemaConfiguration } from 'vscode-json-languageservice';
import { getStaticAndDerivedSchemaAssociations } from './imljson-schema-associations';

/**
 * Fixture suite validating IMLJSON api/base files against the real schemas in
 * `syntaxes/imljson/schemas/`, using the same JSON schema engine (5.7.2) as the vendored
 * language server, configured with the production schema association list.
 */

const MODULE_URI = 'file:///t/apps-sdk/sdk/apps/demo-app/2/modules/get-things/api.imljson';
const ENDPOINT_URI = 'file:///t/apps-sdk/sdk/apps/demo-app/2/endpoints/list-things/api.imljson';
const LOCAL_ENDPOINT_URI = 'file:///w/src/endpoints/list-things/list-things.communication.iml.json';
const BASE_URI = 'file:///t/apps-sdk/sdk/apps/demo-app/2/base.imljson';
const INPUT_PARAMS_URI = 'file:///t/apps-sdk/sdk/apps/demo-app/2/endpoints/list-things/inputParameters.imljson';
const OUTPUT_PARAMS_URI = 'file:///t/apps-sdk/sdk/apps/demo-app/2/endpoints/list-things/outputParameters.imljson';

function resolveRelativePath(relativePath: string, resource: string): string {
	return new URL(relativePath, resource).toString();
}

async function schemaRequestService(uri: string): Promise<string> {
	return fs.readFile(fileURLToPath(uri), 'utf8');
}

function buildLanguageService(schemas: SchemaConfiguration[]): LanguageService {
	const languageService = getLanguageService({ schemaRequestService, workspaceContext: { resolveRelativePath } });
	languageService.configure({ validate: true, allowComments: true, schemas });
	return languageService;
}

async function validate(languageService: LanguageService, uri: string, content: string): Promise<string[]> {
	const document = TextDocument.create(uri, 'imljson', 1, content);
	const jsonDocument = languageService.parseJSONDocument(document);
	const diagnostics = await languageService.doValidation(document, jsonDocument, {
		comments: 'ignore',
		trailingCommas: 'warning',
	});
	return diagnostics.map((diagnostic) => diagnostic.message);
}

suite('Endpoint IMLJSON schema validation (fixtures)', () => {
	const languageService = buildLanguageService(getStaticAndDerivedSchemaAssociations());

	test('1. module: endpoint object form + response → OK', async () => {
		const messages = await validate(languageService, MODULE_URI, '{"endpoint":{"name":"x"},"response":{}}');
		assert.deepStrictEqual(messages, []);
	});

	test('2. module: endpoint shorthand string form → OK', async () => {
		const messages = await validate(languageService, MODULE_URI, '{"endpoint":"x"}');
		assert.deepStrictEqual(messages, []);
	});

	test('3. module: input without endpoint → dependency error', async () => {
		const messages = await validate(languageService, MODULE_URI, '{"input":{},"url":"/x"}');
		assert.deepStrictEqual(messages, ['Object is missing property endpoint required by property input.']);
	});

	test('4. module: endpoint with url/method → banned-directive errorMessage', async () => {
		const messages = await validate(languageService, MODULE_URI, '{"endpoint":"x","url":"/y","method":"GET"}');
		assert.ok(messages.length > 0);
		for (const message of messages) {
			assert.strictEqual(
				message,
				"Not allowed when 'endpoint' is present — the request runs a sibling Endpoint instead of an HTTP request.",
			);
		}
	});

	test('5. module: valid endpointPagination → OK', async () => {
		const messages = await validate(
			languageService,
			MODULE_URI,
			'{"endpoint":"x","pagination":{"endpoint":"y","mergeWithParent":true,"input":{}}}',
		);
		assert.deepStrictEqual(messages, []);
	});

	test('6. module: classic pagination.url with endpoint present → error', async () => {
		const messages = await validate(languageService, MODULE_URI, '{"endpoint":"x","pagination":{"url":"/next"}}');
		assert.deepStrictEqual(messages, ['Property url is not allowed.']);
	});

	test('7. module: plain HTTP request → OK', async () => {
		const messages = await validate(languageService, MODULE_URI, '{"url":"/things","method":"GET"}');
		assert.deepStrictEqual(messages, []);
	});

	test('8. module: array of requests → OK', async () => {
		const messages = await validate(
			languageService,
			MODULE_URI,
			'[{"url":"/a","method":"GET"},{"url":"/b","method":"GET"}]',
		);
		assert.deepStrictEqual(messages, []);
	});

	test('9. endpoint api.imljson: endpoint directive → error (combined match)', async () => {
		const messages = await validate(languageService, ENDPOINT_URI, '{"endpoint":"x"}');
		assert.ok(
			messages.includes('Matches a schema that is not allowed.'),
			`Expected a "not allowed" error, got: ${JSON.stringify(messages)}`,
		);
	});

	test('10. endpoint api.imljson: array form → error', async () => {
		const messages = await validate(languageService, ENDPOINT_URI, '[{"url":"/a","method":"GET"}]');
		assert.ok(messages.length > 0, 'Expected the array-root form to be rejected for an Endpoint api file.');
	});

	test('11. plain HTTP request at endpoint (online + local-dev) URIs → OK', async () => {
		const onlineMessages = await validate(languageService, ENDPOINT_URI, '{"url":"/things","method":"GET"}');
		assert.deepStrictEqual(onlineMessages, []);

		const localMessages = await validate(languageService, LOCAL_ENDPOINT_URI, '{"url":"/things","method":"GET"}');
		assert.deepStrictEqual(localMessages, []);
	});

	test('12. inputParameters.imljson: parameter missing `help` → error', async () => {
		const messages = await validate(languageService, INPUT_PARAMS_URI, '[{"name":"foo","type":"text"}]');
		assert.deepStrictEqual(messages, ['Missing property "help".']);
	});

	test('13. inputParameters.imljson: parameter missing `name` → error', async () => {
		const messages = await validate(languageService, INPUT_PARAMS_URI, '[{"type":"text","help":"h"}]');
		assert.deepStrictEqual(messages, ['Missing property "name".']);
	});

	test('14. inputParameters.imljson: `banner` type is rejected', async () => {
		const messages = await validate(
			languageService,
			INPUT_PARAMS_URI,
			'[{"name":"foo","type":"banner","help":"h"}]',
		);
		assert.ok(messages.length > 0, 'Expected the banner type to be rejected.');
	});

	test('15. inputParameters.imljson: top-level `json` field must be named "inputSchema"', async () => {
		const okMessages = await validate(
			languageService,
			INPUT_PARAMS_URI,
			'[{"name":"inputSchema","type":"json","help":"h"}]',
		);
		assert.deepStrictEqual(okMessages, []);

		const errorMessages = await validate(
			languageService,
			INPUT_PARAMS_URI,
			'[{"name":"result","type":"json","help":"h"}]',
		);
		assert.ok(errorMessages.length > 0, 'Expected a mismatched top-level json name to be rejected.');
	});

	test('16. outputParameters.imljson: top-level `json` field must be named "outputSchema"', async () => {
		const okMessages = await validate(
			languageService,
			OUTPUT_PARAMS_URI,
			'[{"name":"outputSchema","type":"json","help":"h"}]',
		);
		assert.deepStrictEqual(okMessages, []);

		const errorMessages = await validate(
			languageService,
			OUTPUT_PARAMS_URI,
			'[{"name":"result","type":"json","help":"h"}]',
		);
		assert.ok(errorMessages.length > 0, 'Expected a mismatched top-level json name to be rejected.');
	});

	test('17. inputParameters.imljson: nested parameter missing `help` → error (recursion)', async () => {
		const messages = await validate(
			languageService,
			INPUT_PARAMS_URI,
			'[{"name":"parent","type":"collection","help":"h","nested":[{"name":"child","type":"text"}]}]',
		);
		assert.deepStrictEqual(messages, ['Missing property "help".']);
	});

	test('18. base.imljson: timeout within bounds → OK, over the maximum → error', async () => {
		const okMessages = await validate(languageService, BASE_URI, '{"timeout":30000}');
		assert.deepStrictEqual(okMessages, []);

		const errorMessages = await validate(languageService, BASE_URI, '{"timeout":400000}');
		assert.deepStrictEqual(errorMessages, ['Value is above the maximum of 300000.']);
	});
});
