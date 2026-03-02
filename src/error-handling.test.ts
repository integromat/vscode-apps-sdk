import * as assert from 'node:assert';
import { describe, test } from 'mocha';
import { AxiosError, AxiosHeaders } from 'axios';
import { errorToString } from './error-handling';

/**
 * Helper to create an AxiosError with a given response data and status.
 */
function createAxiosError(responseData: any, status = 500, statusText = 'Internal Server Error'): AxiosError {
	const headers = new AxiosHeaders();
	return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
		data: responseData,
		status,
		statusText,
		headers,
		config: { headers },
	});
}

describe('errorToString()', () => {
	describe('AxiosError', () => {
		test('should extract detail string from response body', () => {
			const err = createAxiosError({ detail: 'Module name is invalid' });
			const result = errorToString(err);
			assert.strictEqual(result.message, 'Module name is invalid');
		});

		test('should extract detail array from response body', () => {
			const err = createAxiosError({ detail: ['Error 1', 'Error 2'] });
			const result = errorToString(err);
			assert.strictEqual(result.message, 'Error 1 - Error 2');
		});

		test('should extract suberrors from response body', () => {
			const err = createAxiosError({
				detail: 'Main error',
				suberrors: [{ message: 'Sub error 1' }, { message: 'Sub error 2' }],
			});
			const result = errorToString(err);
			assert.strictEqual(result.message, 'Main error - Sub error 1 - Sub error 2');
		});

		test('should extract suberrors even without detail', () => {
			const err = createAxiosError({
				suberrors: [{ message: 'Sub error only' }],
			});
			const result = errorToString(err);
			assert.strictEqual(result.message, 'Sub error only');
		});

		test('should extract message from response body when no detail/suberrors', () => {
			const err = createAxiosError({ message: 'Bad request' });
			const result = errorToString(err);
			assert.strictEqual(result.message, 'Bad request');
		});

		test('should include additional response body properties alongside message', () => {
			const err = createAxiosError({
				message: 'Internal Server Error',
				code: 'IM004',
				description: 'Module name conflicts with existing module',
			});
			const result = errorToString(err);
			// compare the exact match of message
			assert.ok(
				result.message ===
					'Internal Server Error - Additional response body properties: {"code":"IM004","description":"Module name conflicts with existing module"}',
			);
		});

		test('should not duplicate info when message is the only property', () => {
			const err = createAxiosError({ message: 'Simple error' });
			const result = errorToString(err);
			assert.strictEqual(result.message, 'Simple error');
		});

		test('should use string response data directly', () => {
			const err = createAxiosError('Something failed on server');
			const result = errorToString(err);
			assert.strictEqual(result.message, 'Something failed on server');
		});

		test('should JSON.stringify object response data without known fields', () => {
			const err = createAxiosError({ error: 'unknown_error', code: 42 });
			const result = errorToString(err);
			assert.strictEqual(result.message, JSON.stringify({ error: 'unknown_error', code: 42 }));
		});

		test('should JSON.stringify empty object response data', () => {
			const err = createAxiosError({}, 502, 'Bad Gateway');
			const result = errorToString(err);
			assert.strictEqual(result.message, '{}');
		});
	});

	describe('Specific errors should be rewritten to more user-friendly message with link to known issue', () => {
		test('should improve known error about invalid name pattern', () => {
			const result = errorToString("Value doesn't match pattern in parameter 'name'.");
			assert.strictEqual(result.isImproved, true);
			assert.ok(result.message.includes('invalid ID'));
		});

		test('should improve known error about JSONC position', () => {
			const result = errorToString('Unexpected token in JSONC at position 42');
			assert.strictEqual(result.isImproved, true);
			assert.ok(result.message.includes('JSON has corrupted structure'));
		});

		test('should improve known error about primary connection', () => {
			const result = errorToString('Primary connection must not be the same as the alternative one.');
			assert.strictEqual(result.isImproved, true);
			assert.ok(result.message.includes('KNOWN BUG'));
		});

		test('should improve known error about connection deletion', () => {
			const result = errorToString('Connection cannot be deleted when alternative connection exists.');
			assert.strictEqual(result.isImproved, true);
			assert.ok(result.message.includes('KNOWN BUG'));
		});
	});

	describe('Generic errors', () => {
		test('should return plain string as-is', () => {
			const result = errorToString('Something went wrong');
			assert.strictEqual(result.message, 'Something went wrong');
		});

		test('should extract message from plain Error', () => {
			const result = errorToString(new Error('Something broke'));
			assert.strictEqual(result.message, 'Something broke');
		});
	});
});
