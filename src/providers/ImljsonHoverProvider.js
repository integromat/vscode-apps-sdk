const vscode = require('vscode');

class ImljsonHoverProvider{
    provideHover(document, position){
        let range = document.getWordRangeAtPosition(position)
        let text = document.getText(range)
        let ans
        switch(text){
            case 'name': 
                ans = new vscode.MarkdownString('## name\r\n___\r\n- Type: `String`\r\n- **Required**\r\n- Internal parameter name. This is they key in the resulting object.')
                break
            case 'type':
                ans = new vscode.MarkdownString('## type\r\n___\r\n- Type: `Enum`\r\n- **Required**\r\n- For more information see the list of available types in the [docs](https://integromat.github.io/apps/articles/parameters.html).')
                break
            case 'label':
                ans = new vscode.MarkdownString('## label\r\n___\r\n- Type: `String`\r\n- Parameter label for the user.')
                break
            case 'help':
                ans = new vscode.MarkdownString('## help\r\n___\r\n- Type: `String`\r\n- Parameter description for the user.')
                break
            case 'default':
                ans = new vscode.MarkdownString('## default\r\n___\r\n- Type: `Any`\r\n- Specifies the default value of the parameter.')
                break
            case 'advanced': 
                ans = new vscode.MarkdownString('## advanced\r\n___\r\n- Type: `Boolean`\r\n- Specifies if the parameter is advanced or not. Advanced parameters are hidden behind a checkbox in GUI.\r\n- Default: `false`')
                break
            case 'required': 
                ans = new vscode.MarkdownString('## required\r\n___\r\n- Type: `Boolean`\r\n- Specifies if the parameter is required.\r\n- Default: `false`')
                break
            case 'editable':
                ans = new vscode.MarkdownString('## editable\r\n___\r\n- Type: `Boolean`\r\n- If `true`, the user can manually edit the value of this parameter (or use mappings)\r\n- Default: `false`')
                break
            case 'spec': 
                ans = new vscode.MarkdownString('## spec\r\n___\r\n- Type: `Array/Object`\r\n- Description of items in the array or collection.')
                break
            case 'time': 
                ans = new vscode.MarkdownString('## time\r\n___\r\n- Type: `Boolean`\r\n- If `false` the GUI will only display date selection.\r\n- Default: `true`')
                break
            case 'extension':
                ans = new vscode.MarkdownString('## extension\r\n___\r\n- Type: `String/Array`\r\n- Allowed file extensions.')
                break
            case 'multiple':
                ans = new vscode.MarkdownString('## multiple\r\n___\r\n- Type: `Boolean`\r\n- If `true`, multiple selection is allowed.\r\n- Default: `false`')
                break
            case 'mode':
                ans = new vscode.MarkdownString('## mode\r\n___\r\n- Type: `String`\r\n- Specifies the initial **editing mode** when editable set to `true`. Can be set to `edit` to start in **mapping mode** or to `choose` to start in **select mode**\r\n- Default: `choose`')
                break
            case 'grouped': 
                ans = new vscode.MarkdownString('## grouped\r\n___\r\n- Type: `Boolean`\r\n- If `true`, options can be grouped. Replace value with options to change the option to a group.')
                break
            case 'multiline':
                ans = new vscode.MarkdownString('## multiline\r\n___\r\n- Type: `Boolean`\r\n- If `true`, user will be able to insert new lines in GUI.\r\n- Default: `false`')
                break
            case 'baseUrl':
                ans = new vscode.MarkdownString('## baseUrl\r\n___\r\n- Type: `URL`\r\n- Base structure all modules and remote procedures inherits from.')
        }
        return ans ? new vscode.Hover(ans) : undefined
    }
}

module.exports = ImljsonHoverProvider