import * as vscode from 'vscode';

/**
 * Display the VS Code input box to ask user to enter the free text.
 */
export async function askFreeText(opt: {
	subject: string;
	note?: string;
	placeHolder?: string;
	required?: boolean;
}): Promise<string | undefined> {
	let freeText: string | undefined;
	do {
		freeText = await vscode.window.showInputBox({
			ignoreFocusOut: true,
			placeHolder: opt.placeHolder,
			title: (freeText !== undefined ? 'MUST NOT TO BE EMPTY. Try again to ' : '') + `Enter the ${opt.subject}:`,
			prompt: opt.note,
			value: freeText,
		});
		if (freeText === undefined) {
			return undefined;
		}
	} while (opt.required && freeText.length === 0);
	return freeText;
}
