/**
 * Endpoint Input/Output parameters are consumed by AI agents, so every parameter (at every nesting
 * level) must carry a `help` description and a `name`, the purely-visual `banner` type isn't offered
 * here, and a top-level `json` field must use the canonical name for its tab.
 *
 * Rather than duplicate the large `parameters.json`, this derives an endpoint-scoped variant from it:
 * - `help` is added to the shared `parameter` definition's `required` list — all nested parameters
 *   reference that same definition, so the rule applies recursively.
 * - `banner` is removed from the allowed `type` values (a literal `"banner"` can't slip through the
 *   IML-string branch, which requires `{{ }}`).
 * - `name` is required on every *named* parameter (top-level fields and object/collection properties),
 *   because a nameless field is silently dropped from the generated object schema. Array item specs
 *   describe the item type rather than a named property, so they keep using the base `parameter`.
 * - A *top-level* `json` field must be named `jsonFieldName` (`inputSchema`/`outputSchema`), so the
 *   exposed schema is consistent. Scoped to the top level so multiple/nested `json` fields (which
 *   would collide on the same name) aren't forced.
 *
 * Ported from imt-web-zone's `apps-edit-monaco-iml.service.ts` (`buildEndpointParametersSchema`).
 *
 * @param parametersSchema - The parsed `syntaxes/imljson/schemas/parameters.json` content. Not mutated.
 * @param jsonFieldName - The canonical name a top-level `json`-type parameter must use.
 * @returns A deep-copied, endpoint-scoped variant of `parametersSchema`.
 */
export function buildEndpointParametersSchema(
	parametersSchema: Record<string, unknown>,
	jsonFieldName: 'inputSchema' | 'outputSchema',
): Record<string, unknown> {
	const schema = JSON.parse(JSON.stringify(parametersSchema)) as Record<string, unknown>;
	const definitions = schema.definitions as Record<string, Record<string, unknown>>;
	const parameter = definitions.parameter;

	const parameterRequired = parameter.required as string[];
	if (!parameterRequired.includes('help')) {
		parameter.required = [...parameterRequired, 'help'];
	}

	const parameterProperties = parameter.properties as Record<string, Record<string, unknown>>;
	const typeOneOf = parameterProperties.type.oneOf as { enum?: string[] }[];
	typeOneOf[0].enum = (typeOneOf[0].enum as string[]).filter((type) => type !== 'banner');
	const bannerProps = new Set(['title', 'text', 'closable', 'theme', 'badge']);
	parameter.properties = Object.fromEntries(
		Object.entries(parameterProperties).filter(([propName]) => !bannerProps.has(propName)),
	);

	// A named parameter requires `name`. Point the nested "named" contexts at it: the `parameters`
	// array (collection properties, nested fields, rpc form fields). Array item specs still reference
	// the base `parameter` (no name needed).
	definitions.namedParameter = {
		allOf: [{ $ref: '#/definitions/parameter' }, { required: ['name'] }],
	};
	definitions.parameters.items = { $ref: '#/definitions/namedParameter' };

	// A top-level parameter is a named parameter that, when it's a `json` field, must use the tab's
	// canonical name. Only the top-level `items` reference it, so nested `json` fields are unaffected.
	definitions.topLevelParameter = {
		allOf: [
			{ $ref: '#/definitions/namedParameter' },
			{
				if: { properties: { type: { const: 'json' } }, required: ['type'] },
				then: { properties: { name: { const: jsonFieldName } } },
			},
		],
	};
	schema.items = { $ref: '#/definitions/topLevelParameter' };

	// Drop per-definition `$id`s so these fragments don't collide with the shared parameters.json schema.
	for (const definition of Object.values(definitions)) {
		delete definition.$id;
	}

	return schema;
}
