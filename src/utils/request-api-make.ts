import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { setTimeout } from 'timers/promises';
import throat from 'throat';
import { progresDialogReport } from './vscode-progress-dialog';
import * as Meta from '../Meta';

const limitConcurrently = throat(2);

/**
 * Works as official Axios lib, but adds couple of features required to ask Make API endpoinds.
 *
 *  - Handles with 429 Too many requests error response
 *  - Adds header with VSCode Extension version.
 */

export async function requestMakeApi(config: AxiosRequestConfig): Promise<any>;
export async function requestMakeApi<T>(config: AxiosRequestConfig): Promise<T>;
export async function requestMakeApi<T>(config: AxiosRequestConfig): Promise<T> {
	try {
		return limitConcurrently(async () => {
			try {
				return (await axios<T>({
					...config,
					headers: {
						...(config.headers ?? {}),
						'x-imt-apps-sdk-version': Meta.version,
					}
				})).data;
			} catch (e: any) {
				if ((<AxiosError>e).response?.status === 429) {
					progresDialogReport('Too many requests into Make. Slowing down. Please wait.');
					await setTimeout(5000); // Bloks also anothers requests (`limitConcurrently`)
				}
				throw e;
			}
		});
	} catch (e: any) {
		// Try again
		if ((<AxiosError>e).response?.status === 429) {
			return requestMakeApi(config);
		}
		throw e;
	}
}
