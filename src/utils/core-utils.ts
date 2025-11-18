/**
 * Older utilities, moved from Core.ts into a separate file for better modularity.
 */

export function isVersionable(item: string): boolean {
	return !['connection', 'webhook', 'connections', 'webhooks'].includes(item);
}
