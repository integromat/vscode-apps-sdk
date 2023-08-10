import { GeneralCodeName } from '../types/general-code-name.types';
import { AppComponentType } from '../types/app-component-type.types';

const imljsonc = {
	fileext: 'imljson',
	mimetype: 'application/jsonc',
};

const json = {
	fileext: 'imljson',
	mimetype: 'application/jsonc',
};

export const appCodesDefinition: Record<GeneralCodeName, CodeDef> = {
	// TODO rename to General
	base: {
		filename: 'base',
		fileext: 'imljson',
		mimetype: 'application/jsonc',
	},
	common: {
		fileext: 'json',
		mimetype: 'application/json',
	},
	content: {
		filename: 'readme',
		fileext: 'md',
		mimetype: 'text/markdown',
	},
	groups: {
		fileext: 'json',
		mimetype: 'application/json',
	},
};

const componentsDefinition: Record<AppComponentType, Record<string, CodeDef>> = {
	connection: {
		api: { ...imljsonc, filename: 'communication' },
		parameters: imljsonc,
		common: json,
		/** Scope list. Visible for `type='oauth'` only. */
		scopes: { ...imljsonc, filename: 'scope-list' },
		/** Default scope. Visible for `type='oauth'` only.*/
		scope: { ...imljsonc, filename: 'default-scope' },
		/** Install specification parameters. Visible for `type='oauth'` only. */
		installSpec: { ...imljsonc, filename: 'install-spec' },
		/** Install directives. Visible for `type='oauth'` only. */
		install: { ...imljsonc, filename: 'install-directives' },
	},
	webhook: {
		api: { ...imljsonc, filename: 'communication' },
		parameters: imljsonc,
		attach: imljsonc,
		detach: imljsonc,
		update: imljsonc,
		scope: { ...imljsonc, filename: 'required-scope' },
	},
	module: {
		api: { ...imljsonc, filename: 'communication' },
		epoch: imljsonc, // TODO Looks like visible in pooling trigger only
		parameters: { ...imljsonc, filename: 'static-params' },
		expect: { ...imljsonc, filename: 'mappable-params' },
		interface: imljsonc,
		samples: imljsonc,
		scope: imljsonc, // TODO: Not visible in trigger, search, action, universal. Looks like not visible anywhere.
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

export function getAppComponentDefinition(appComponentType: AppComponentType) {
	if (!componentsDefinition[appComponentType]) {
		throw new Error(`Unsupported component name: ${appComponentType}`);
	}

	return componentsDefinition[appComponentType];
}

export function getAppComponentCodeDefinition(appComponentType: AppComponentType, codeName: string): CodeDef {
	const componentDef = getAppComponentDefinition(appComponentType);

	if (!componentDef[codeName]) {
		throw new Error(`Unsupported component code name: ${appComponentType}->${codeName}`);
	}

	return componentDef[codeName];
}

/**
 * Returns definition of app's direct codes
 */
export function getAppCodeDefinition(appCodeName: GeneralCodeName): CodeDef {
	const componentDef: CodeDef | undefined = appCodesDefinition[appCodeName];

	if (!componentDef) {
		throw new Error(`Unsupported app base code name: ${appCodeName}`);
	}

	return componentDef;
}

export function getAppComponentTypes(): AppComponentType[] {
	return Object.keys(componentsDefinition) as AppComponentType[];
}

interface CodeDef {
	mimetype: string;
	fileext: string;
	filename?: string;
}
