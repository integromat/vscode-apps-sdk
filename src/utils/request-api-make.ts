import { setTimeout } from 'node:timers/promises';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import throat from 'throat';
import * as Meta from '../Meta';

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
					await setTimeout(5000); // Bloks also anothers requests (because of `limitConcurrently`)
				}
				throw e;
			}
		});
	} catch (e: any) {
		// Try again.
		// Note, because the new try is called outside the `limitConcurrently()` block, the next try is enqueued to end of the queue.
		if ((<AxiosError>e).response?.status === 429) {
			return requestMakeApi(config);
		}
		throw e;
	}
}
