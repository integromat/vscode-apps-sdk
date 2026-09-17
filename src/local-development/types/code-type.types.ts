type ConnectionCodeType =
	| 'communication'
	| 'params'
	| 'common'
	| 'scopeList'
	| 'defaultScope'
	| 'installSpec'
	| 'installDirectives';

type WebhookCodeType = 'communication' | 'params' | 'attach' | 'detach' | 'update' | 'requiredScope';

type ModuleCodeType = 'communication' | 'epoch' | 'staticParams' | 'mappableParams' | 'interface' | 'samples' | 'scope';

type RpcCodeType = 'communication' | 'params';

type FunctionCodeType = 'code' | 'test';

type EndpointCodeType = 'communication' | 'scope' | 'inputParameters' | 'outputParameters' | 'context';

/**
 * General code type.
 * It is very similar to `ApiCodeType`, but these are more aligned with names used in web UI.
 */
export type GeneralCodeType = 'base' | 'common' | 'readme' | 'groups';

/**
 * Component code type.
 * It is very similar to `ApiCodeType`, but these are more aligned with names used in web UI.
 */
export type ComponentCodeType =
	| ConnectionCodeType
	| WebhookCodeType
	| ModuleCodeType
	| RpcCodeType
	| FunctionCodeType
	| EndpointCodeType;

export type CodeType = ComponentCodeType | GeneralCodeType;

/**
 * Technical component+general code types used in API endpoints and in Make back-end.
 */
export type ApiCodeType =
	// Connection
	| 'api'
	| 'parameters'
	| 'common'
	| 'scopes'
	| 'scope'
	| 'installSpec'
	| 'install'
	// + Webhook
	| 'attach'
	| 'detach'
	| 'update'
	// + Module
	| 'epoch'
	| 'expect'
	| 'interface'
	| 'samples'
	// + Endpoint
	| 'inputParameters'
	| 'outputParameters'
	| 'context'
	// + Function
	| 'code'
	| 'test'
	// + Generic
	| 'base'
	| 'content'
	| 'groups';
