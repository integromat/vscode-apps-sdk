import throat from 'throat';
import * as vscode from 'vscode';
import { getMakecomappJson, getMakecomappRootDir } from './makecomappjson';

const limitConcurrency = throat(1);

/**
 * Adds a new module ID to `groups.json` in case the file is not empty (= if it is used).
 * Default target group is `Other` if exists, else the last one.
 */
export async function optionalAddModuleToDefaultGroup(anyProjectPath: vscode.Uri, newModuleID: string): Promise<void> {
	// TODO remap newModuleID to originModuleName (now newModuleID is localModuleName)
	const groupsCodeFilePath = (await getMakecomappJson(anyProjectPath)).generalCodeFiles.groups;
	if (groupsCodeFilePath === null) {
		// Do not do anything if the groups file is being ignored in project.
		return;
	}
	const makeappRootdir = getMakecomappRootDir(anyProjectPath);
	const groupsCodeUri = vscode.Uri.joinPath(makeappRootdir, groupsCodeFilePath);

	await limitConcurrency(async () => {
		// Load the groups.json file content
		const groupsJson: GroupsJson = JSON.parse(
			new TextDecoder().decode(await vscode.workspace.fs.readFile(groupsCodeUri)),
		);

		// Add new module
		if (groupsJson.length > 0) {
			const targetGroup =
				groupsJson.find((group) => group.label === 'Other') ?? groupsJson[groupsJson.length - 1];
			targetGroup.modules.push(newModuleID);
			// Save updated file content
			await vscode.workspace.fs.writeFile(
				groupsCodeUri,
				new TextEncoder().encode(JSON.stringify(groupsJson, null, 4)),
			);
		}
	});
}

export async function removeModuleFromGroups(anyProjectPath: vscode.Uri, originModuleName: string): Promise<void> {
	const groupsCodeFilePath = (await getMakecomappJson(anyProjectPath)).generalCodeFiles.groups;
	if (groupsCodeFilePath === null) {
		// Do not do anything if the groups file is being ignored in project.
		return;
	}
	const makeappRootdir = getMakecomappRootDir(anyProjectPath);
	const groupsCodeUri = vscode.Uri.joinPath(makeappRootdir, groupsCodeFilePath);

	await limitConcurrency(async () => {
		const groupsJson: GroupsJson = JSON.parse(
			new TextDecoder().decode(await vscode.workspace.fs.readFile(groupsCodeUri)),
		);

		// Filter module from all groups.
		groupsJson.forEach((item: GroupJsonItem) => {
			item.modules = item.modules.filter(module => module !== originModuleName);
		});

		// Save changes
		await vscode.workspace.fs.writeFile(
			groupsCodeUri,
			new TextEncoder().encode(JSON.stringify(groupsJson, null, 4)),
		);
	});
}

/**
 * Structure of `groups.json` code file
 */
type GroupsJson = GroupJsonItem[];

interface GroupJsonItem {
	label: string;
	modules: string[];
}
