import type { AxiosRequestConfig } from 'axios';
import type { AppComponentMetadata, LocalAppOriginWithSecret, MakecomappJson } from './types/makecomapp.types';
import { getComponentApiUrl } from './helpers/api-url';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';
import { log } from '../output-channel';
import type { AppComponentType } from '../types/app-component-type.types';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { requestMakeApi } from '../utils/request-api-make';
import { getModuleDefFromType } from '../services/module-types-naming';
import type { EndpointAnnotations } from '../types/component-types.types';
import type { Checksum } from './types/checksum.types';
import { compareChecksumDeep } from './helpers/origin-checksum';
import { isNotOwnedByApp } from './align-components-mapping';

/**
 * Sets the local component metadata into remote `origin`.
 */
export async function deployComponentMetadata(
	componentType: AppComponentType,
	componentLocalId: string,
	componentMetadata: AppComponentMetadata,
	makecomappJson: MakecomappJson,
	origin: LocalAppOriginWithSecret,
	originChecksum: Checksum,
): Promise<void> {
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

	// if remote component is not owned by the app, do not deploy metadata for now
	if (
		isNotOwnedByApp(
			remoteComponentName,
			componentType,
			originChecksum, // this is used to check if the component is owned by the app (if it has a checksum in the originChecksums.accounts --- IGNORE ---
		)
	) {
		log(
			'info',
			`Skipping metadata deployment of component '${componentType}' with name ‘${remoteComponentName}’: component is not owned by the app.`,
		);
		progresDialogReport(
			`Skipping metadata deployment of component '${componentType}' with name ‘${remoteComponentName}’`,
		);
		return;
	}

	const metadataToUpdate = getApiBodyForComponentMetadataDeploy(
		componentType,
		componentMetadata,
		makecomappJson,
		origin,
	);
	if (Object.keys(metadataToUpdate).length === 0) {
		// Nothing to update
		return;
	}

	const metadataChecksumMatches = compareChecksumDeep(
		originChecksum,
		componentType,
		remoteComponentName,
		metadataToUpdate,
	);
	if (!metadataChecksumMatches) {
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
	} else {
		log(
			'info',
			`Skipping metadata deployment of component '${componentType}' with name ‘${remoteComponentName}’: local is identical to origin.`,
		);
	}

	progresDialogReport('');
}

/**
 * Generates list of metadata, which can be set during component creation and can be changed during component update.
 * @return in format, which can be direclty used in REST API request body.
 */
export function getApiBodyForComponentMetadataDeploy(
	componentType: AppComponentType,
	componentMetadata: AppComponentMetadata,
	makecomappJson: MakecomappJson,
	origin: LocalAppOriginWithSecret,
): Record<string, string | number | string[] | EndpointAnnotations | null | undefined> {
	const updatingMetadataApiProps: ReturnType<typeof getApiBodyForComponentMetadataDeploy> = {};

	const componentIdMapping = new ComponentIdMappingHelper(makecomappJson, origin);

	// Update `label`
	if (['connection', 'module', 'webhook', 'rpc', 'endpoint'].includes(componentType) && componentMetadata.label) {
		updatingMetadataApiProps.label = componentMetadata.label;
	}

	// Update `description`
	if (['module', 'endpoint'].includes(componentType) && componentMetadata.description) {
		updatingMetadataApiProps.description = componentMetadata.description;
	}

	// Endpoint-specific metadata: `annotations`, `attachedAccounts` (array of connection references).
	// Note: `context` is NOT deployed here — it is a metadata-backed source code file deployed via
	//       `deployComponentCode()` (PATCHes the `context` field), so it stays a single source of truth.
	if (componentType === 'endpoint') {
		if (componentMetadata.annotations !== undefined) {
			updatingMetadataApiProps.annotations = componentMetadata.annotations;
		}
		if (componentMetadata.attachedAccounts !== undefined) {
			// Translate each connection reference from local ID to remote name. Drop ignored/unresolved ones.
			updatingMetadataApiProps.attachedAccounts = componentMetadata.attachedAccounts
				.map((localConnectionId) =>
					componentIdMapping.getComponentReferenceRemoteNameForApiPatch('connection', localConnectionId),
				)
				.filter((remoteName): remoteName is string => typeof remoteName === 'string');
		}
	}

	// Update module type
	if (componentType === 'module' && componentMetadata.moduleType) {
		updatingMetadataApiProps.typeId = getModuleDefFromType(componentMetadata.moduleType).type_id;
	}

	// Update action module's `crud`
	if (
		componentType === 'module' &&
		componentMetadata.moduleType === 'action' &&
		componentMetadata.actionCrud !== undefined
	) {
		updatingMetadataApiProps.crud = componentMetadata.actionCrud;
	}

	// Update `webhook` reference
	if (componentType === 'module' && componentMetadata.moduleType === 'instant_trigger') {
		updatingMetadataApiProps.webhook = componentIdMapping.getComponentReferenceRemoteNameForApiPatch(
			'webhook',
			componentMetadata.webhook,
		);
	}

	// Update `connection`, `altConnection` references
	if (['module', 'webhook', 'rpc'].includes(componentType)) {
		updatingMetadataApiProps.connection = componentIdMapping.getComponentReferenceRemoteNameForApiPatch(
			'connection',
			componentMetadata.connection,
		);
		updatingMetadataApiProps.altConnection = componentIdMapping.getComponentReferenceRemoteNameForApiPatch(
			'connection',
			componentMetadata.altConnection,
		);
	}

	return updatingMetadataApiProps;
}
