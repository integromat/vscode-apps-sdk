import { downloadAndStoreAppIcon } from './app-icon';
import { log } from '../output-channel';
import type { Environment } from '../types/environment.types';

interface BackgroundIconLoaderOptions {
	baseUrl: string;
	authorization: string;
	environment: Environment;
	/** Passed as the `isAppOpensource` flag to `downloadAndStoreAppIcon`. */
	isOpensource: boolean;
	/** Prefix for error logs, e.g. "Background app" or "Background example". */
	logLabel: string;
	/** Called once after a run finishes caching icons, so the tree can re-render. */
	onLoaded: () => void;
}

/**
 * Loads app icons in the background and caches their versions. Shared by the
 * Custom apps and Examples tree providers to avoid duplicating this logic.
 *
 * Guarantees:
 *  - Single-flight: only one run executes at a time.
 *  - Cancellable: `reset()` bumps a token so stale runs stop and cannot overwrite
 *    the cache or fire a stale refresh.
 *  - Resilient: a single icon failure is logged and skipped, never aborting the batch.
 */
export class BackgroundIconLoader {
	private readonly options: BackgroundIconLoaderOptions;
	private readonly iconVersions = new Map<string, number>();
	private loaded = false;
	private loading = false;
	private token = 0;

	constructor(options: BackgroundIconLoaderOptions) {
		this.options = options;
	}

	/** Whether a run has completed and cached all icon versions. */
	get isLoaded(): boolean {
		return this.loaded;
	}

	/** Resolved icon version for an app (0 = not yet cached / no icon). */
	getIconVersion(name: string, version: number): number {
		return this.iconVersions.get(`${name}@${version}`) ?? 0;
	}

	/** Cancel any in-flight run and clear cached versions so icons are reloaded. */
	reset(): void {
		this.token++;
		this.loading = false;
		this.loaded = false;
		this.iconVersions.clear();
	}

	/** Start a background run. No-op if a run is already in flight (single-flight). */
	start(appsData: { name: string; version: number }[]): void {
		if (this.loading) {
			return;
		}
		this.loading = true;
		const token = ++this.token;
		setImmediate(async () => {
			try {
				for (const app of appsData) {
					// Bail out if this run was superseded (reset or a newer run).
					if (token !== this.token) {
						return;
					}
					try {
						const iconVersion = await downloadAndStoreAppIcon(
							app as any,
							this.options.baseUrl,
							this.options.authorization,
							this.options.environment,
							this.options.isOpensource,
						);
						if (token !== this.token) {
							return;
						}
						this.iconVersions.set(`${app.name}@${app.version}`, iconVersion);
					} catch (err: any) {
						// Isolate per-app failures (e.g. a corrupt PNG) so one bad icon does not abort the batch.
						log('error', `${this.options.logLabel} icon load failed for ${app.name}@${app.version}: ${err.message}`);
					}
				}
				if (token === this.token) {
					this.loaded = true;
					this.options.onLoaded();
				}
			} catch (err: any) {
				log('error', `${this.options.logLabel} icon load failed: ${err.message}`);
			} finally {
				// Release the single-flight lock only if we still own the current run.
				if (token === this.token) {
					this.loading = false;
				}
			}
		});
	}
}
