/**
 * This storage hold the user's decisions/preferences, like:
 *
 * - Error ignoring/muting
 * - Default origin
 *
 * Based on the in-memory storage implementation, all preferences are "reseted to default" on VS Code or Extension restart.
 */
export const userPreferences = new Map<string, any>();
