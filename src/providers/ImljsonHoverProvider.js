const vscode = require('vscode');

class ImljsonHoverProvider {
	provideHover(document, position) {

		// If hover over key
		let range = document.getWordRangeAtPosition(position, new RegExp(`"([a-z])+":`))
		if (range && range.isSingleLine) {
			let key = document.getText(range).slice(1, -2)
			let help = this.provideKeyHover(key)
			if (['name', 'type', 'label', 'help', 'default', 'advanced', 'required'].includes(key)) {
				help = help.concat(`\r\n- For more information see the [docs](https://docs.integromat.com/apps/other/parameters#${key}).`)
			}
			return help ? new vscode.Hover(new vscode.MarkdownString(`## ${key}\r\n___\r\n${help}`)) : undefined
		}

		// If hover over parameter type
		range = document.getWordRangeAtPosition(position, new RegExp(`"type": "([a-z]+)"`))
		if (range && range.isSingleLine) {
			let type = document.getText(range).slice(9, -1)
			let help = this.provideTypeHover(type)
			// Cover grouped docs pages
			let customLink
			if (type === "integer" || type === "uinteger") { customLink = 'integer-uinteger' }
			if (type === "folder" || type === "file") { customLink = 'folder-file' }
			return help ? new vscode.Hover(new vscode.MarkdownString(`## ${type}\r\n___\r\n${help}\r\n- For more information see the [docs](https://docs.integromat.com/apps/other/parameters/${customLink || type}).`)) : undefined
		}
	}

	provideKeyHover(text) {
		switch (text) {
			case 'name': return '- Type: `String`\r\n- **Required**\r\n- Internal parameter name. This is the key in the resulting object. Can contain arbitary characters.'
			case 'type': return '- Type: `String`\r\n- **Required**\r\n- A type of the parameter.'
			case 'label': return '- Type: `String`\r\n- Parameter label for the user which is displayed in GUI.'
			case 'help': return '- Type: `String`\r\n- Parameter description for the user which is displayed in GUI.'
			case 'default': return '- Type: `Any`\r\n- Specifies the default value of the parameter.'
			case 'advanced': return '- Type: `Boolean`\r\n- Specifies if the parameter is advanced or not. Advanced parameters are hidden behind a checkbox in GUI.\r\n- Default: `false`'
			case 'required': return '- Type: `Boolean`\r\n- Specifies if the parameter is required.\r\n- Default: `false`'
			case 'editable': return '- Type: `Boolean`\r\n- If `true`, the user can manually edit the value of this parameter (or use mappings)\r\n- Default: `false`'
			case 'spec': return '- Type: `Array/Object`\r\n- Description of items in the array or collection.'
			case 'time': return '- Type: `Boolean`\r\n- If `false` the GUI will only display date selection.\r\n- Default: `true`'
			case 'extension': return '- Type: `String/Array`\r\n- Allowed file extensions.'
			case 'multiple': return '- Type: `Boolean`\r\n- If `true`, multiple selection is allowed.\r\n- Default: `false`'
			case 'mode': return '- Type: `String`\r\n- Specifies the initial **editing mode** when editable set to `true`. Can be set to `edit` to start in **mapping mode** or to `choose` to start in **select mode**\r\n- Default: `choose`'
			case 'grouped': return '- Type: `Boolean`\r\n- If `true`, options can be grouped. Replace value with options to change the option to a group.'
			case 'multiline': return '- Type: `Boolean`\r\n- If `true`, user will be able to insert new lines in GUI.\r\n- Default: `false`'
			case 'baseUrl': return '- Type: `URL`\r\n- Base structure all modules and remote procedures inherits from.'
			case 'options': return '- Type: `String`, `Array` or `Object`\r\n- The syntax of options may differ depending on the parameter type.'
			case 'nested': return '- Type: `String`, `Array` or `Object`\r\n- The syntax of nested may differ depending on the parameter type.\r\n- Nested items are shown only when some condition is true, for example an option is picked or a checkbox is checked.'
			case 'validate': return '- Type: `Object`\r\n- The validate object specifies additional validation rules\r\n- Allowed keys in this object may differ depending on the parameter type.'
			case 'value': return '- Type: `String`\r\n- A value of the option.'
			default: return undefined
		}
	}

	provideTypeHover(text) {
		switch (text) {
			case 'array': return '- Array of items of the same type'
			case 'boolean': return '- `true` or `false` value'
			case 'buffer': return '- Binary buffer'
			case 'cert': return '- Certifcate in PEM format'
			case 'collection': return '- An object'
			case 'color': return '- Hexadecimal color input'
			case 'date': return '- Date or date with time'
			case 'email': return '- Allows only a valid email address to be filled in'
			case 'file': return '- File selection'
			case 'filename': return '- File name'
			case 'filter': return '- An advanced parameter used for filtering'
			case 'folder': return '- Folder selection'
			case 'hidden': return '- Parameter of this type is hidden from the user'
			case 'integer': return '- Whole number'
			case 'number': return '- A number'
			case 'path': return '- A path to a file or a folder'
			case 'pkey': return '- Private key in PEM format'
			case 'port': return '- A whole number in range from 1 to 65535'
			case 'select': return '- A selection from predefined values'
			case 'text': return '- Text value'
			case 'time': return '- Time in `hh:mm` or `hh:mm:ss` or `hh:mm:ss.nnn` format'
			case 'timestamp': return '- Unix timestamp'
			case 'timezone': return '- Time zone name (e.g. Europe/Prague)'
			case 'uinteger': return '- Positive whole number'
			case 'url': return '- URL address'
			case 'uuid': return 'UUID'
			default: return undefined
		}
	}
}
module.exports = ImljsonHoverProvider