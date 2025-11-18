import { URI, Utils } from 'vscode-uri';

/**
 * Wrapper class that extends vscode-uri's URI with additional static methods
 * to match the full vscode.Uri interface, specifically adding joinPath.
 */
export class Uri extends URI {
	/**
	 * Creates a new URI by joining path segments to a base URI.
	 * This method is present in vscode.Uri but missing in vscode-uri package.
	 *
	 * @param base The base URI
	 * @param pathSegments Path segments to append
	 */
	static joinPath(base: URI, ...pathSegments: string[]): Uri {
		// Use Utils.joinPath from vscode-uri which provides this functionality
		return Utils.joinPath(base, ...pathSegments) as Uri;
	}

	// Re-export all static methods from URI to ensure they're available on Uri class
	// static override isUri = URI.isUri;
	static override parse = URI.parse;
	static override file = URI.file;
	static override from = URI.from;
	// static override revive = URI.revive;
}
