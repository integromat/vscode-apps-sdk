import sanitize from 'sanitize-filename';
import throat from 'throat';
import type * as IVscode from 'vscode';
import type { AppComponentType } from '../types/app-component-type.types';
import { camelToKebab } from '../utils/camel-to-kebab';
import { getFirstNonExistingPath } from '../utils/non-existing-path';
import { vscodeLibWrapperFactory } from '../services/vscode-lib-wraper';

const vscode = vscodeLibWrapperFactory.lib;

const limitConcurrency = throat(1);

/**
 * Gets the target directory, where to store the component.
 * The empty directory is also created in FS as reservation for component files.
 */
export async function reserveComponentCodeFilesDirectory(
	componentType: AppComponentType,
	componentName: string,
	localAppRootdir: IVscode.Uri,
): Promise<IVscode.Uri> {
	return limitConcurrency(async () => {
		const componentDir = await getFirstNonExistingPath(
			vscode.Uri.joinPath(localAppRootdir, componentType + 's'),
			sanitize(camelToKebab(componentName)) || 'unnamed',
		);

		// Create empty directory
		vscode.workspace.fs.createDirectory(componentDir);
		return componentDir;
	});
}
