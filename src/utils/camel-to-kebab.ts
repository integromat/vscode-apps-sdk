/**
 * Transforms the given string from camelCase to kebab-case.
 *
 * Source: https://quickref.me/convert-camel-case-to-kebab-case-and-vice-versa.html
 */
export function camelToKebab(str: string): string {
	return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
