import * as vscode from 'vscode';
import throat from 'throat';
import { AppComponentType } from '../types/app-component-type.types';
import { camelToKebab } from '../utils/camel-to-kebab';
import { getFirstNonExistingPath } from '../utils/non-existing-path';

const limitConcurrency = throat(1);

/**
 * Gets the target directory, where to store the component.
 * The empty directory is also created in FS as reservation for component files.
 */
export async function reserveComponentCodeFilesDirectory(
	componentType: AppComponentType,
	componentName: string,
	localAppRootdir: vscode.Uri,
): Promise<vscode.Uri> {
	return limitConcurrency(async () => {
		const componentDir = await getFirstNonExistingPath(
			vscode.Uri.joinPath(localAppRootdir, componentType + 's'),
			camelToKebab(componentName),
			0,
		);

		// Create empty directory
		vscode.workspace.fs.createDirectory(componentDir);
		return componentDir;
	});
}
