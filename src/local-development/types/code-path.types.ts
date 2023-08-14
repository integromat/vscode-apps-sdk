import * as vscode from 'vscode';
import { AppComponentType } from '../../types/app-component-type.types';

export interface CodePath {
	componentType: AppComponentType | 'app';
	componentName: string;
	codeName: string;
	localFile: vscode.Uri;
}
