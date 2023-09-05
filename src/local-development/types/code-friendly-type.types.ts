type ConnectionCodeFriendlyType =
	| 'communication'
	| 'params'
	| 'common'
	| 'scopeList'
	| 'defaultScope'
	| 'installSpec'
	| 'installDirectives';

type WebhookCodeUserFriendlyType = 'communication' | 'params' | 'attach' | 'detach' | 'update' | 'requiredScope';

type ModuleCodeFriendlyType = 'communication' | 'epoch' | 'staticParams' | 'mappableParams' | 'interface' | 'samples';

type RpcCodeFriendlyType = 'communication' | 'params';

type FunctionCodeFriendlyType = 'code' | 'test';

export type GeneralCodeFriendlyType = 'base' | 'common' | 'readme' | 'groups';

/**
 * To prevent confusing the user by backend code names like 'api',
 * there is translation from backend code types into more user friendly one.
 */
export type ComponentCodeFriendlyType =
	| ConnectionCodeFriendlyType
	| WebhookCodeUserFriendlyType
	| ModuleCodeFriendlyType
	| RpcCodeFriendlyType
	| FunctionCodeFriendlyType;

export type CodeFriendlyType = ComponentCodeFriendlyType | GeneralCodeFriendlyType;
