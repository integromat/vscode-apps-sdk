import { AppComponentType } from '../types/app-component-type.types';
import { CodeDef } from '../local-development/types/code-def.types';
import { componentTypesDeployOrder } from './component-types-order';
import { ComponentCodeType, GeneralCodeType } from '../local-development/types/code-type.types';
import { keys } from '../utils/typed-object';

const imljsonc = {
	fileext: 'iml.json',
	mimetype: 'application/jsonc',
};

const json = {
	fileext: 'json',
	mimetype: 'application/json',
};

export const generalCodesDefinition: Record<GeneralCodeType, CodeDef> = {
	base: {
		...imljsonc,
		apiCodeType: 'base',
		filename: 'general/base',
	},
	common: { apiCodeType: 'common', ...json, filename: 'general/common' },
	readme: {
		apiCodeType: 'content',
		filename: 'README',
		fileext: 'md',
		mimetype: 'text/markdown',
	},
	groups: { ...json, apiCodeType: 'groups', filename: 'modules/groups' },
};

/**
 * Defines all types of app components (like module, connection, ...)
 * and the appropriate code files for each component type.
 */
export const componentsCodesDefinition: Record<AppComponentType, Partial<Record<ComponentCodeType, CodeDef>>> = {
	connection: {
		communication: {
			...imljsonc,
			apiCodeType: 'api',
			filename: (componentType, componentMetadata) => {
				if (componentType === 'connection' && componentMetadata!.connectionType === 'oauth') {
					// Special case: Oauth connection API code has the different JSON schema than Basic connection.
					// To match the right json schema the filename must be different for this case.
					return 'oauth-communication';
				}
				return 'communication';
			},
		},
		params: { ...imljsonc, apiCodeType: 'parameters', filename: 'params' },
		common: { ...json, apiCodeType: 'common' },
		scopeList: {
			...imljsonc,
			apiCodeType: 'scopes',
			filename: 'scope-list',
			onlyFor: (componentMetadata) => componentMetadata.connectionType === 'oauth',
		},
		defaultScope: {
			...imljsonc,
			apiCodeType: 'scope',
			filename: 'default-scope',
			onlyFor: (componentMetadata) => componentMetadata.connectionType === 'oauth',
		},
		installSpec: {
			...imljsonc,
			apiCodeType: 'installSpec',
			filename: 'install-spec',
			onlyFor: (componentMetadata) => componentMetadata.connectionType === 'oauth',
		},
		installDirectives: {
			...imljsonc,
			apiCodeType: 'install',
			filename: 'install-directives',
			onlyFor: (componentMetadata) => componentMetadata.connectionType === 'oauth',
		},
	},
	webhook: {
		communication: { ...imljsonc, apiCodeType: 'api', filename: 'communication' },
		params: { ...imljsonc, apiCodeType: 'parameters', filename: 'params' },
		attach: { ...imljsonc, apiCodeType: 'attach' },
		detach: { ...imljsonc, apiCodeType: 'detach' },
		update: { ...imljsonc, apiCodeType: 'update' },
		requiredScope: { ...imljsonc, apiCodeType: 'scope', filename: 'required-scope' },
	},
	module: {
		communication: { ...imljsonc, apiCodeType: 'api', filename: 'communication' },
		epoch: {
			...imljsonc,
			apiCodeType: 'epoch',
			onlyFor: (componentMetadata) => componentMetadata.moduleType === 'trigger',
		},
		staticParams: { ...imljsonc, apiCodeType: 'parameters', filename: 'static-params' },
		mappableParams: { ...imljsonc, apiCodeType: 'expect', filename: 'mappable-params' },
		interface: { ...imljsonc, apiCodeType: 'interface' },
		samples: { ...imljsonc, apiCodeType: 'samples' },
		scope: {
			...imljsonc,
			apiCodeType: 'scope',
			onlyFor: (componentMedatata) =>
				// Note: In the product it is additional rule for `scope` code visibility: module must have associated an OAuth connection
				['trigger', 'action', 'search', 'universal'].includes(componentMedatata.moduleType!),
		},
	},
	rpc: {
		communication: { ...imljsonc, apiCodeType: 'api', filename: 'communication' },
		params: { ...imljsonc, apiCodeType: 'parameters', filename: 'params' },
	},
	function: {
		code: { apiCodeType: 'code', fileext: 'js', mimetype: 'application/javascript' },
		test: { apiCodeType: 'test', fileext: 'js', mimetype: 'application/javascript' },
	},
};

export function getAppComponentCodesDefinition(appComponentType: AppComponentType) {
	if (!componentsCodesDefinition[appComponentType]) {
		throw new Error(`Unsupported component name: ${appComponentType}`);
	}

	return componentsCodesDefinition[appComponentType];
}

export function getAppComponentCodeDefinition(
	appComponentType: AppComponentType,
	codeType: ComponentCodeType,
): CodeDef {
	const componentCodesDef = getAppComponentCodesDefinition(appComponentType);

	const codeDef = componentCodesDef[codeType];
	if (!codeDef) {
		throw new Error(`Unsupported component code type: ${appComponentType}->${codeType}`);
	}

	return codeDef;
}

/**
 * Returns definition of app's direct codes
 */
export function getGeneralCodeDefinition(codeType: GeneralCodeType): CodeDef {
	const componentDef: CodeDef | undefined = generalCodesDefinition[codeType];

	if (!componentDef) {
		throw new Error(`Unsupported app base code type: ${codeType}`);
	}

	return componentDef;
}

/**
 * Returns list of component types ['function', 'module, 'rpc', ...]
 * in the correct order, in which to deploy or pull to not break any dependencies (connection references, ...)
 */
export function getAppComponentTypes(): AppComponentType[] {
	const types = keys(componentsCodesDefinition);
	return types.sort((compType1, compType2) => {
		return componentTypesDeployOrder[compType1] - componentTypesDeployOrder[compType2];
	});
}
