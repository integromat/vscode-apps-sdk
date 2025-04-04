import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { Environment } from './types/environment.types';
import { showAndLogError } from './error-handling';
import { requestMakeApi } from './utils/request-api-make';

export async function rpGet(uri: string, authorization: string, qs?: Record<string, string | string[] | boolean>) {
	try {
		return await requestMakeApi({
			url: uri,
			headers: {
				Authorization: authorization,
			},
			params: qs,
		});
	} catch (err: any) {
		showAndLogError(err, 'rpGet');
		throw err;
	}
}

export function getApp(item: any): any {
	return item.parent === undefined ? item : getApp(item.parent);
}

export function isVersionable(item: string) {
	return !['connection', 'webhook', 'connections', 'webhooks'].includes(item);
}

export function contextGuard(context: any) {
	if (context === undefined || context === null) {
		vscode.window.showErrorMessage(
			'This command should not be called directly. Please use it from application context menu.',
		);
		return false;
	}
	return true;
}

export function envGuard(environment: Environment, available: number[]) {
	if (!available.includes(environment.version)) {
		vscode.window.showErrorMessage('Not available in this version of Integromat.');
		return false;
	}
	return true;
}

export function isFilled(subject: string, object: string, thing: any, article?: string, the?: boolean) {
	if (thing === undefined || thing === '' || thing === null) {
		vscode.window.showWarningMessage(
			`${article || 'A'} ${subject} for ${the === false ? '' : 'the'} ${object} has not been specified.`,
		);
		return false;
	}
	return true;
}

export async function addEntity(authorization: string, body: any, url: string) {
	return requestMakeApi({
		method: 'POST',
		url: url,
		data: body,
		headers: {
			Authorization: authorization,
		},
	});
}

export async function deleteEntity(authorization: string, body: any, url: string) {
	return requestMakeApi({
		method: 'DELETE',
		url: url,
		data: body,
		headers: {
			Authorization: authorization,
		},
	});
}

export async function editEntity(authorization: string, body: any, url: string) {
	return requestMakeApi({
		method: 'PUT',
		url: url,
		data: body,
		headers: {
			Authorization: authorization,
		},
	});
}

export async function patchEntity(authorization: string, body: any, url: string) {
	return requestMakeApi({
		method: 'PATCH',
		url: url,
		data: body,
		headers: {
			Authorization: authorization,
		},
	});
}

export async function editEntityPlain(authorization: string, value: string | undefined, url: string) {
	return requestMakeApi({
		method: 'PUT',
		url: url,
		data: value,
		headers: {
			Authorization: authorization,
			'Content-Type': 'text/plain',
		},
	});
}

export async function executePlain(authorization: string, value: string, url: string) {
	return requestMakeApi({
		method: 'POST',
		url: url,
		data: value,
		headers: {
			Authorization: authorization,
			'Content-Type': 'text/plain',
		},
	});
}

export async function getAppObject(environment: Environment, authorization: string, app: SdkApp) {
	if (environment.version === 2) {
		return (await rpGet(`${environment.baseUrl}/sdk/apps/${app.name}/${app.version}`, authorization)).app;
	} else {
		return await rpGet(`${environment.baseUrl}/app/${app.name}/${app.version}`, authorization);
	}
}

export function getIconHtml(uri: string, color: string, dir: string) {
	return fs
		.readFileSync(path.join(dir, 'static', 'icon.html'), 'utf8')
		.replace('___iconbase', uri)
		.replace('___theme', color);
}

export function getRpcTestHtml(name: string, app: string, version: string, dir: string) {
	return fs
		.readFileSync(path.join(dir, 'static', 'rpc-test.html'), 'utf8')
		.replace('___rpcName', name)
		.replace('___appName', app)
		.replace('___version', version);
}

export function getUdtGeneratorHtml(dir: string) {
	return fs.readFileSync(path.join(dir, 'static', 'udt-gen.html'), 'utf-8');
}

export function getAppDetailHtml(dir: string) {
	return fs.readFileSync(path.join(dir, 'static', 'app-detail.html'), 'utf-8');
}

export function getModuleDetailHtml(dir: string) {
	return fs.readFileSync(path.join(dir, 'static', 'module-detail.html'), 'utf-8');
}

export function compareCountries(a: { picked: boolean; label: string }, b: { picked: boolean; label: string }) {
	// Sort by PICK
	if (a.picked && !b.picked) return -1;
	if (b.picked && !a.picked) return 1;

	// Sort by NAME
	return a.label.localeCompare(b.label);
}

export function compareApps(a: { bareLabel: string }, b: { bareLabel: string }) {
	return a.bareLabel.localeCompare(b.bareLabel);
}

export function jsonString(text: any, sectionGuard: string | undefined): string {
	// Section Guard to prevent NULLs in exported filed
	if (sectionGuard !== undefined) {
		if (text === null) {
			if (sectionGuard === 'samples') {
				text = {};
			} else {
				text = [];
			}
		}
	}

	if (typeof text === 'object' && text !== null) {
		return JSON.stringify(text, null, 4);
	}
	return text;
}

export function pathDeterminer(version: number, originalPath: string): string {
	switch (version) {
		case 2:
			switch (originalPath) {
				case 'app':
					return 'apps';
				case 'connection':
					return 'connections';
				case 'webhook':
					return 'webhooks';
				case 'module':
					return 'modules';
				case 'rpc':
					return 'rpcs';
				case 'function':
					return 'functions';
				case 'change':
					return 'changes';
				case '__sdk':
					return 'sdk/';
				default:
					return '';
			}
		case 1:
		default:
			if (originalPath === '__sdk') {
				return '';
			} else {
				return originalPath;
			}
	}
}

interface SdkApp {
	name: string;
	version: number;
	color: string;
}
