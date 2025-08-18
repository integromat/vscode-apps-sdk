/**
 * Describes the response of API endpoint `v2/sdk/apps/${appName}/${appVersion}/checksum`
 */
export interface Checksum {
	modules: ComponentChecksum[];
	rpcs: ComponentChecksum[];
	functions: ComponentChecksum[];
	accounts: ComponentChecksum[];
	hooks: ComponentChecksum[];
	app: ComponentChecksum[];
}

export interface ComponentChecksum {
	/** Component Name */
	name: string;
	/**
	 * Component externality, valid only for some components.
	 * The most common case is for connections, where this component is owned by another major version of the same Custom App.
	 */
	external?: boolean;
	/** Record of all component columns, where each column is represented by its name and MD5 hash.
	 * @example: {label: 'd41d8cd98f00b204e9800998ecf8427e', type: '9e107d9d372bb6826bd81d3542a419d6'}
	 */
	checksum: Record<string, string | null>;
}
