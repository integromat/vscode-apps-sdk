import * as assert from "assert";
import { camelToKebab } from "./camel-to-kebab";

suite("utils.camelToKebab()", () => {
	test("should transform camelCase to kebab-case", () => {
		assert.equal(camelToKebab("camelCase"), "camel-case");
		assert.equal(camelToKebab("camelCaseString"), "camel-case-string");
		assert.equal(
			camelToKebab("camelCaseStringWithNumbers123"),
			"camel-case-string-with-numbers123"
		);
	});

	test("should handle empty string", () => {
		assert.equal(camelToKebab(""), "");
	});

	test("should handle non-alphabetic characters", () => {
		assert.equal(camelToKebab("camelCase!"), "camel-case!");
		assert.equal(camelToKebab("camelCase_"), "camel-case_");
		assert.equal(camelToKebab("camelCase123"), "camel-case123");
	});

	test("should handle already kebab-case strings", () => {
		assert.equal(camelToKebab("kebab-case"), "kebab-case");
		assert.equal(camelToKebab("kebab-case-string"), "kebab-case-string");
		assert.equal(
			camelToKebab("kebab-case-string-with-numbers123"),
			"kebab-case-string-with-numbers123"
		);
	});
});
