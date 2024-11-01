export type AppComponentType = 'connection' | 'webhook' | 'module' | 'rpc' | 'function';

export const AppComponentTypes: AppComponentType[] = ['connection', 'webhook', 'module', 'rpc', 'function'];

/**
 * It is pseudotype used in API endpoint for general codes like "base", "common", "content" (readme).
 */
export type AppGeneralType = 'app';
