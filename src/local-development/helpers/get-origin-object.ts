import { LocalAppOrigin, MakecomappJson } from '../types/makecomapp.types';

/**
 * Returns the origin object freom makecomapp.json.
 * Used for editation this object for case, when input `origin` can be a clone of this object.
 */
export function getOriginObject(makecomappJson: MakecomappJson, origin: LocalAppOrigin): LocalAppOrigin {
	const originInMakecomappJsons = makecomappJson.origins.filter((requestedOrigin) =>
		compareOrigins(requestedOrigin, origin),
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


function compareOrigins(origin1: LocalAppOrigin, origin2: LocalAppOrigin): boolean {
	return (
		origin1.appId === origin2.appId &&
		origin1.appVersion === origin2.appVersion &&
		origin1.baseUrl === origin2.baseUrl &&
		origin1.label === origin2.label
	);
}
