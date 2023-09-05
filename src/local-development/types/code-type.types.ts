type ConnectionCodeType =
	| 'communication'
	| 'params'
	| 'common'
	| 'scopeList'
	| 'defaultScope'
	| 'installSpec'
	| 'installDirectives';

type WebhookCodeType = 'communication' | 'params' | 'attach' | 'detach' | 'update' | 'requiredScope';

type ModuleCodeType = 'communication' | 'epoch' | 'staticParams' | 'mappableParams' | 'interface' | 'samples';

type RpcCodeType = 'communication' | 'params';

type FunctionCodeType = 'code' | 'test';

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
	| FunctionCodeType;

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
	// + Function
	| 'code'
	| 'test'
	// + Generic
	| 'base'
	| 'content'
	| 'groups';
