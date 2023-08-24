import path from 'path';
import * as vscode from 'vscode';
import throat from 'throat';
import { AppComponentType } from '../types/app-component-type.types';
import { camelToKebab } from '../utils/camel-to-kebab';

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
		let postfix = 0;
		let localdir: string;
		do {
			localdir = path.join(componentType + 's', camelToKebab(componentName + (postfix ? '-' + postfix : '')));
			// Check if path (directory) already exists
			try {
				await vscode.workspace.fs.stat(vscode.Uri.joinPath(localAppRootdir, localdir));
			} catch (e: any) {
				if (e.code === 'FileNotFound') {
					// This is the right directory for component.
					const componentDir = vscode.Uri.joinPath(localAppRootdir, localdir);
					// Create empty directory
					vscode.workspace.fs.createDirectory(componentDir);
					return componentDir;
				}
				throw e; // Unknown error
			}
			postfix++;
		} while (postfix < 100);
		throw new Error('Component directory postfix number exceeded the maximum.');
	});
}
