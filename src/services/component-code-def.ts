import { AppComponentType } from "../types/app-component-type.types";

const imljsonc = {
	fileext: 'imljson',
	mimetype: 'application/jsonc',
};
const json = {
	fileext: 'json',
	mimetype: 'application/json',
};

const modulesDefinition: Record<AppComponentType, Record<string, any>> = {
	app: {
		content: {
			filename: 'readme',
			fileext: 'md',
			mimetype: 'text/markdown',
		},
		common: {
			fileext: 'imljson',
			mimetype: 'application/json',
		},
	},
	module: {
		'api': imljsonc,
		'parameters': imljsonc,
		'expect': imljsonc,
		'interface': imljsonc,
		'samples': imljsonc,
		'scope': imljsonc,
	},

	// function: // TODO
	// rpc: // TODO
	// module: // TODO
	// connection: // TODO
	// webhook: // TODO
};


export function getAppComponentDefinition(appComponentType: AppComponentType) {

	if (!modulesDefinition[appComponentType]) {
		throw new Error(`Unsupported component name: ${appComponentType}`);
	}

	return modulesDefinition[appComponentType];
}


export function getAppComponentCodeDefinition(appComponentType: AppComponentType, codeName: string): {
	mimetype: string,
	fileext: string,
	filename?: string,
} {
	const componentDef = getAppComponentDefinition(appComponentType);

	if (!componentDef[codeName]) {
		throw new Error(`Unsupported code name: ${appComponentType}->${codeName}`);
	}

	return componentDef[codeName];
}


export function getAppComponentTypes(): AppComponentType[] {
	return Object.keys(modulesDefinition) as AppComponentType[];
}
