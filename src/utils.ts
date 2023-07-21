/**
 * Promisify a function with a callback function parameters (data: any, error?: Error).
 *
 * Similar as `promisify` in `util` module, but callback parameters are in opposite order
 * (here: data first, error second; original Node util.promisify: error first, data second).
 *
 * Note: Named `promisify2` to avoid conflict with original `promisify` in `util` module.
 */
export function promisify2<T, A extends any[]>(
	func: (callback: CallbackFunc<T>, ...args: A) => void
): (...args: A) => Promise<T> {
    return (...args) => {
		return new Promise((resolve, reject) => {
			func((data, err) => {
				if (err) {
					return reject(err);
				}
				return resolve(data);
			}, ...args);
		});
	};
}

type CallbackFunc<T> = (data: T, err?: undefined | Error) => void;
