import { AppCodeName } from "../types/app-code-name.types";
import { AppComponentType } from "../types/app-component-type.types";

const imljsonc = {
	fileext: 'imljson',
	mimetype: 'application/jsonc',
};

export const appCodesDefinition: Record<AppCodeName, CodeDef> = {
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
};

const componentsDefinition: Record<AppComponentType, Record<string, CodeDef>> = {
	connection: {
		api: { ...imljsonc, filename: 'base' },
		parameters: imljsonc,
	},
	webhook: {
		api: { ...imljsonc, filename: 'base' },
		parameters: imljsonc,
		attach: imljsonc,
		detach: imljsonc,
		update: imljsonc,
	},
	module: {
		api: { ...imljsonc, filename: 'base' },
		// TODO Static vs mappable parameters
		parameters: imljsonc,
		expect: imljsonc,
		interface: imljsonc,
		samples: imljsonc,
		scope: imljsonc,
	},
	rpc: {
		api: { ...imljsonc, filename: 'base' },
		parameters: imljsonc,
	},
	function: {
		code: { fileext: 'js', mimetype: 'application/javascript' },
		test: { fileext: 'js', mimetype: 'application/javascript' },
	}
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
export function getAppCodeDefinition(appCodeName: AppCodeName): CodeDef {
	const componentDef: CodeDef|undefined = appCodesDefinition[appCodeName];

	if (!componentDef) {
		throw new Error(`Unsupported app base code name: ${appCodeName}`);
	}

	return componentDef;
}


export function getAppComponentTypes(): AppComponentType[] {
	return Object.keys(componentsDefinition) as AppComponentType[];
}


interface CodeDef {
	mimetype: string,
	fileext: string,
	filename?: string,
}
