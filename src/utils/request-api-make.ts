import { setTimeout } from 'node:timers/promises';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import throat from 'throat';
import { progresDialogReport } from './vscode-progress-dialog';
import * as Meta from '../Meta';
import { errorToString } from '../error-handling';

const limitConcurrently = throat(2);

/**
 * Requests the HTTP call to the Make.com API.
 * Works as official Axios lib, but adds couple of features required to ask the Make.com API endpoints.
 *
 *  - Handles with 429 Too many requests error response
 *  - Adds header with VSCode Extension version.
 *  - Limits the parallel calls to 2 (multiple requests are enqueued and resolved one ofter other).
 */

export async function requestMakeApi(config: AxiosRequestConfig): Promise<any>;
export async function requestMakeApi<T>(config: AxiosRequestConfig): Promise<T>;
export async function requestMakeApi<T>(config: AxiosRequestConfig): Promise<T> {
	try {
		return await limitConcurrently(async () => {
			try {
				return (
					await axios<T>({
						...config,
						headers: {
							...(config.headers ?? {}),
							'imt-apps-sdk-version': Meta.version,
						},
					})
				).data;
			} catch (err: any) {
				if ((<AxiosError>err).response?.status === 429) {
					progresDialogReport('Too many requests into Make. Slowing down. Please wait.');
					await setTimeout(5000); // Bloks also anothers requests (because of `limitConcurrently`)
					throw err;
				} else {
					// TODO Do not put the APi URL as part of error message. Instead of it, implement the log the URL based on `cause` original error. Implement it in `error-handling.ts` -> `showAndLogError()`.
					throw new Error(
						'Rejected the Make request ' +
							(err.request?.method || '').toUpperCase() +
							' ' +
							err.request?.host +
							err.request?.path +
							', response: ' +
							// Extract error messages from API response body
							errorToString(err),
						{ cause: err },
					);
				}
			}
		});
	} catch (e: any) {
		// Try again.
		// Note, because the new try is called outside the `limitConcurrently()` block, the next try is enqueued to end of the queue.
		if ((<AxiosError>e).response?.status === 429) {
			return requestMakeApi(config);
		} else {
			throw e;
		}
	}
}
