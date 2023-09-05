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
