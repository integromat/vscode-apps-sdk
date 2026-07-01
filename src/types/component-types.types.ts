export type ModuleType = 'trigger' | 'action' | 'search' | 'instant_trigger' | 'responder' | 'universal';

export type WebhookType = 'web' | 'web-shared';

export type ConnectionType = 'basic' | 'oauth';

/**
 * MCP-inspired behavior hints of an endpoint. All optional booleans.
 */
export interface EndpointAnnotations {
	/** If true, the endpoint does not modify its environment. */
	readOnlyHint?: boolean;
	/** If true, the endpoint may perform destructive updates; if false, updates are only additive. */
	destructiveHint?: boolean;
	/** If true, repeated calls with the same arguments have no additional effect. */
	idempotentHint?: boolean;
	/** If true, the endpoint may interact with an "open world" of external entities. */
	openWorldHint?: boolean;
}
