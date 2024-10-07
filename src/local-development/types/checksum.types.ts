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
	name: string;
	checksum: Record<string, string | null>;
}
