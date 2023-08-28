import { GeneralCodeName } from '../types/general-code-name.types';
import { AppComponentType } from '../types/app-component-type.types';
import { CodeDef } from '../local-development/types/code-def.types';
import { componentTypesDeployOrder } from './component-types-order';

const imljsonc = {
	fileext: 'iml.json',
	mimetype: 'application/jsonc',
};

const json = {
	fileext: 'json',
	mimetype: 'application/json',
};

export const generalCodesDefinition: Record<GeneralCodeName, CodeDef> = {
	base: {
		filename: 'general/base',
		fileext: 'imljson',
		mimetype: 'application/jsonc',
	},
	common: { ...json, filename: 'general/common' },
	content: {
		filename: 'README',
		fileext: 'md',
		mimetype: 'text/markdown',
	},
	groups: { ...json, filename: 'modules/groups' },
};

const componentsCodesDefinition: Record<AppComponentType, Record<string, CodeDef>> = {
	connection: {
		api: {
			...imljsonc,
			filename: (componentType, componentMetadata) => {
				if (componentType === 'connection' && componentMetadata!.connectionType === 'oauth') {
					// Special case: Oauth connection API code has the different JSON schema than Basic connection.
					// To match the right json schema the filename must be different for this case.
					return 'oauth-communication';
				}
				return 'communication';
			},
		},
		parameters: { ...imljsonc, filename: 'params' },
		common: json,
		scopes: {
			...imljsonc,
			filename: 'scope-list',
			onlyFor: (componentMetadata) => componentMetadata.connectionType === 'oauth',
		},
		scope: {
			...imljsonc,
			filename: 'default-scope',
			onlyFor: (componentMetadata) => componentMetadata.connectionType === 'oauth',
		},
		installSpec: {
			...imljsonc,
			filename: 'install-spec',
			onlyFor: (componentMetadata) => componentMetadata.connectionType === 'oauth',
		},
		install: {
			...imljsonc,
			filename: 'install-directives',
			onlyFor: (componentMetadata) => componentMetadata.connectionType === 'oauth',
		},
	},
	webhook: {
		api: { ...imljsonc, filename: 'communication' },
		parameters: { ...imljsonc, filename: 'params' },
		attach: imljsonc,
		detach: imljsonc,
		update: imljsonc,
		scope: { ...imljsonc, filename: 'required-scope' },
	},
	module: {
		api: { ...imljsonc, filename: 'communication' },
		epoch: {
			...imljsonc,
			onlyFor: (componentMetadata) => componentMetadata.moduleSubtype === 'trigger',
		},
		parameters: { ...imljsonc, filename: 'static-params' },
		expect: { ...imljsonc, filename: 'mappable-params' },
		interface: imljsonc,
		samples: imljsonc,
		// scope: imljsonc, // Looks like not visible anywhere, so disabling.
	},
	rpc: {
		api: { ...imljsonc, filename: 'communication' },
		parameters: imljsonc,
	},
	function: {
		code: { fileext: 'js', mimetype: 'application/javascript' },
		test: { fileext: 'js', mimetype: 'application/javascript' },
	},
};

export function getAppComponentCodesDefinition(appComponentType: AppComponentType) {
	if (!componentsCodesDefinition[appComponentType]) {
		throw new Error(`Unsupported component name: ${appComponentType}`);
	}

	return componentsCodesDefinition[appComponentType];
}

export function getAppComponentCodeDefinition(appComponentType: AppComponentType, codeName: string): CodeDef {
	const componentCodesDef = getAppComponentCodesDefinition(appComponentType);

	if (!componentCodesDef[codeName]) {
		throw new Error(`Unsupported component code name: ${appComponentType}->${codeName}`);
	}

	return componentCodesDef[codeName];
}

/**
 * Returns definition of app's direct codes
 */
export function getGeneralCodeDefinition(appCodeName: GeneralCodeName): CodeDef {
	const componentDef: CodeDef | undefined = generalCodesDefinition[appCodeName];

	if (!componentDef) {
		throw new Error(`Unsupported app base code name: ${appCodeName}`);
	}

	return componentDef;
}

/**
 * Returns list of component types ['function', 'module, 'rpc', ...]
 * in the correct order, in which to deploy or pull to not break any dependencies (connection references, ...)
 */
export function getAppComponentTypes(): AppComponentType[] {
	const types = Object.keys(componentsCodesDefinition) as AppComponentType[];
	return types.sort((compType1, compType2) => {
		return componentTypesDeployOrder[compType1] - componentTypesDeployOrder[compType2];
	});
}
