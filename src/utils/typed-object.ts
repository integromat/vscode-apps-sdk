/**
 * Better definition of `Object.entries`.
 */
type ObjectEntriesType = <T, K extends string>(obj: { [k in K]?: T }) => Array<[K, T]>;

/**
 * Same as `Object.keys`.
 *
 * Additional feature: Returns the correct enum type for Record like `Record<SomeEnumType, any>`.
 *
 * Note: Official Object.keys losts the enum type and degradates is into `string` only.
 */
export const keys = Object.keys as <T>(obj: T) => (keyof T)[];

/**
 * Same as `Object.entries`.
 *
 * Additional feature: Returns the correct enum type for Record like `Record<SomeEnumType, any>`.
 *
 * Note: Official Object.entries losts the enum type and degradates is into `string` only.
 */
export const entries = Object.entries as ObjectEntriesType;
