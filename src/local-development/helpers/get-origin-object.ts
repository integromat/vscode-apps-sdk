import { LocalAppOrigin, MakecomappJson } from '../types/makecomapp.types';

/**
 * Finds and returns the fresh/up-to-date reference to makecomapp.json's origin object.
 *
 * Explanation:
 *
 *   The `makecomapp.json` file is always considered as source of thruth.
 *   This function is used for finding the fresh/up-to-date origin's data based on some older/outdated/cloned version of origin.
 *   Most cases of getting a fresh version of `outdatedOrigin` is because `idMapping` data can be changed by another part of this extension.
 *
 * @return Fresh up-to-date version of `outdatedOrigin`.
 *
 */
export function getOriginObject(makecomappJson: MakecomappJson, outdatedOrigin: LocalAppOrigin): LocalAppOrigin {
	const originInMakecomappJsons = makecomappJson.origins.filter((requestedOrigin) =>
		compareOrigins(requestedOrigin, outdatedOrigin),
	);
	if (originInMakecomappJsons.length === 0) {
		throw new Error(
			'Internal error. System was not able to find the actually used origin in "makecomapp.json" file.',
		);
	}
	if (originInMakecomappJsons.length > 1) {
		throw new Error(
			'Please, update origin\'s labels in "makecomapp.json" to be unique. Explanation: Cannot continue, because you have multiple origins defined in "makecomapp.json", which looks similar.',
		);
	}

	return originInMakecomappJsons[0];
}

/**
 * Returns true if both origins objects are same.
 * Purpose: The `origin1` or `origin2` object can be the deep clonned and it is needed to find if both has been borned from same source.
 */
function compareOrigins(origin1: LocalAppOrigin, origin2: LocalAppOrigin): boolean {
	return (
		origin1.appId === origin2.appId &&
		origin1.appVersion === origin2.appVersion &&
		origin1.baseUrl === origin2.baseUrl &&
		origin1.label === origin2.label
	);
}
