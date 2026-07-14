import * as assert from 'node:assert';
import { promises as fs, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { suite, test } from 'mocha';
import {
	getLanguageService,
	TextDocument,
	type LanguageService,
	type SchemaConfiguration,
} from 'vscode-json-languageservice';
import { enrichApiSchemaWithEndpoints, extractEndpointInputParameters } from './endpoint-api-enrichment';
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

suite('Endpoint IMLJSON schema validation (fixtures) — online-mode enrichment', () => {
	const OTHER_APP_URI = 'file:///t/apps-sdk/sdk/apps/other-app/3/modules/get-others/api.imljson';

	// The enriched entry's URI must be a flat sibling of the real schema files (like the production
	// class builds it), so its relative `sources.json#/...` refs still resolve to real files on disk.
	const schemasDir = path.join(__dirname, '../../syntaxes/imljson/schemas');
	const apiSchema = JSON.parse(readFileSync(path.join(schemasDir, 'api.json'), 'utf8')) as Record<string, unknown>;
	// Endpoints built via `extractEndpointInputParameters` from realistic *raw* API-shaped
	// `inputParameters` (not hand-built `EndpointInputParameter[]`), so these fixtures exercise the real
	// extraction → suggestion-entry → completion pipeline end to end for all three shapes.
	const endpoints = [
		{
			name: 'list-things',
			inputParameters: extractEndpointInputParameters([{ name: 'page', label: 'Page number', type: 'integer' }]),
		},
		{
			name: 'list-things-json',
			inputParameters: extractEndpointInputParameters([
				{
					name: 'inputSchema',
					type: 'json',
					schema: {
						type: 'object',
						properties: { id: { type: 'integer', description: 'Thing id' } },
						required: ['id'],
					},
				},
			]),
		},
		{
			name: 'list-things-mixed',
			inputParameters: extractEndpointInputParameters([
				{ name: 'page', label: 'Page number', type: 'integer' },
				{
					name: 'inputSchema',
					type: 'json',
					schema: { type: 'object', properties: { qty: { type: 'integer' } } },
				},
			]),
		},
	];
	const enrichedEntry: SchemaConfiguration = {
		uri: pathToFileURL(path.join(schemasDir, 'api-enriched--demo-app--v2.json')).toString(),
		fileMatch: ['api.imljson', 'publish.imljson', 'attach.imljson', 'detach.imljson'].map(
			(basename) => `**/apps-sdk/**/demo-app/2/**/${basename}`,
		),
		schema: enrichApiSchemaWithEndpoints(apiSchema, endpoints),
	};
	const languageService = buildLanguageService([...getStaticAndDerivedSchemaAssociations(), enrichedEntry]);

	async function inputCompletionLabels(endpointName: string): Promise<(string | undefined)[]> {
		const content = `{"endpoint":"${endpointName}","input":{}}`;
		const document = TextDocument.create(MODULE_URI, 'imljson', 1, content);
		const jsonDocument = languageService.parseJSONDocument(document);
		const position = document.positionAt(content.indexOf('"input":{') + '"input":{'.length);
		const completions = await languageService.doComplete(document, position, jsonDocument);
		return (completions?.items ?? []).map((item) => item.label);
	}

	test('19. module (enriched app/version): known endpoint name → OK', async () => {
		const messages = await validate(languageService, MODULE_URI, '{"endpoint":"list-things"}');
		assert.deepStrictEqual(messages, []);
	});

	test('20. module (enriched app/version): unknown endpoint name → enum error', async () => {
		const messages = await validate(languageService, MODULE_URI, '{"endpoint":"unknown-thing"}');
		assert.ok(messages.length > 0, 'Expected an unknown endpoint name to be rejected.');
	});

	test('21. module (enriched app/version): `{{iml}}` endpoint name → OK', async () => {
		const messages = await validate(languageService, MODULE_URI, '{"endpoint":"{{iml}}"}');
		assert.deepStrictEqual(messages, []);
	});

	test('22. module (different app/version): unknown endpoint name → NO enum error (glob scoping)', async () => {
		const messages = await validate(languageService, OTHER_APP_URI, '{"endpoint":"unknown-thing"}');
		assert.deepStrictEqual(messages, []);
	});

	test("23. module (enriched app/version): input-suggestion entries offer the endpoint's parameter keys", async () => {
		assert.deepStrictEqual(await inputCompletionLabels('list-things'), ['page']);
	});

	test('24. module (JSON-Schema-wrapped endpoint): input-suggestions are the unwrapped properties, not the wrapper name', async () => {
		assert.deepStrictEqual(await inputCompletionLabels('list-things-json'), ['id']);
	});

	test('25. module (mixed form-field + JSON-Schema endpoint): input-suggestions include both', async () => {
		assert.deepStrictEqual(await inputCompletionLabels('list-things-mixed'), ['page', 'qty']);
	});

	test('26. module (JSON-Schema-wrapped endpoint): suggestions do not leak across endpoints, and an unknown/missing key is still not an error', async () => {
		// Referencing one endpoint must not offer another's keys.
		const jsonLabels = await inputCompletionLabels('list-things-json');
		assert.ok(!jsonLabels.includes('page') && !jsonLabels.includes('qty'));

		// Suggestion-only: an unrecognized key, or a missing one the wrapped schema marked `required`,
		// is never flagged — this is completion, not validation.
		const messages = await validate(
			languageService,
			MODULE_URI,
			'{"endpoint":"list-things-json","input":{"somethingElse":1}}',
		);
		assert.deepStrictEqual(messages, []);
	});
});
