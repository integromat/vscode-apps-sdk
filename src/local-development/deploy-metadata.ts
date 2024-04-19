import { AxiosRequestConfig } from 'axios';
import { AppComponentMetadata, LocalAppOriginWithSecret, MakecomappJson } from './types/makecomapp.types';
import { getComponentApiUrl } from './helpers/api-url';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';
import { log } from '../output-channel';
import { AppComponentType } from '../types/app-component-type.types';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { requestMakeApi } from '../utils/request-api-make';

export async function deployComponentMetadata(
	componentType: AppComponentType,
	componentLocalId: string,
	componentMetadata: AppComponentMetadata,
	makecomappJson: MakecomappJson,
	origin: LocalAppOriginWithSecret,
) {
	log(
		'debug',
		`Deploying metadata of ${componentType} "${componentMetadata.label ?? componentLocalId}" into remote app "${
			origin.appId
		}"`,
	);
	progresDialogReport(`Deploying metadata of ${componentMetadata.label ?? componentLocalId} in remote`);

	const componentIdMapping = new ComponentIdMappingHelper(makecomappJson, origin);
	const remoteComponentName = componentIdMapping.getExistingRemoteName(componentType, componentLocalId);
	if (remoteComponentName === null) {
		// Nothing to do
		return undefined;
	}

	const metadataToUpdate = getComponentRemoteMetadataToDeploy(
		componentType,
		componentMetadata,
		makecomappJson,
		origin,
	);
	if (Object.keys(metadataToUpdate).length === 0) {
		// Nothing to update
		return;
	}

	const componentUrl = getComponentApiUrl({ componentType, remoteComponentName, origin });

	const axiosConfig: AxiosRequestConfig = {
		headers: {
			Authorization: 'Token ' + origin.apikey,
		},
		url: componentUrl,
		method: 'PATCH',
		data: metadataToUpdate,
	};
	await requestMakeApi(axiosConfig);

	progresDialogReport('');
}

export function getComponentRemoteMetadataToDeploy(
	componentType: AppComponentType,
	componentMetadata: AppComponentMetadata,
	makecomappJson: MakecomappJson,
	origin: LocalAppOriginWithSecret,
): Record<string, string | null | undefined> {
	const metadataToUpdate: Record<string, string | null | undefined> = {};

	const componentIdMapping = new ComponentIdMappingHelper(makecomappJson, origin);

	// Update `label`
	if (['connection', 'module', 'webhook', 'rpc'].includes(componentType) && componentMetadata.label) {
		metadataToUpdate.label = componentMetadata.label;
	}

	// Update `description`
	if (componentType === 'module' && componentMetadata.description) {
		metadataToUpdate.description = componentMetadata.description;
	}

	// Update `webhook` reference
	if (componentType === 'module' && componentMetadata.moduleType === 'instant_trigger') {
		metadataToUpdate.webhook = componentIdMapping.getComponentReferenceRemoteNameForApiPatch(
			'webhook',
			componentMetadata.webhook,
		);
	}

	// Update `connection`, `altConnection` references
	if (['module', 'webhook', 'rpc'].includes(componentType)) {
		metadataToUpdate.connection = componentIdMapping.getComponentReferenceRemoteNameForApiPatch(
			'connection',
			componentMetadata.connection,
		);
		metadataToUpdate.altConnection = componentIdMapping.getComponentReferenceRemoteNameForApiPatch(
			'connection',
			componentMetadata.altConnection,
		);
	}

	return metadataToUpdate;
}
