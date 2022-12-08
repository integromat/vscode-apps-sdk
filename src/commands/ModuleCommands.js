const vscode = require('vscode')

const Core = require('../Core')
const Validator = require('../Validator')
const Enum = require('../Enum')
const QuickPick = require('../QuickPick')
const Felicia = require('../Felicia');

const camelCase = require('lodash.camelcase');
const path = require('path');
const fs = require('fs');

class ModuleCommands {
    static async register(appsProvider, _authorization, _environment) {

        /**
         * New module
         */
        vscode.commands.registerCommand('apps-sdk.module.new', async function(context) {

            // Context check
            if (!Core.contextGuard(context)) { return }
			let app = context.parent

			// Label prompt
			let label = await vscode.window.showInputBox({ prompt: "Enter module label" })
			if (!Core.isFilled("label", "module", label)) { return }

			// Id prompt
			let id = await vscode.window.showInputBox({
				prompt: "Enter module Id",
				value: camelCase(label),
				validateInput: Validator.moduleName
			})
			if (!Core.isFilled("id", "module", id, "An")) { return }

            // Form Data
			/*
            const form = await Felicia([{
                name: 'label',
                required: true,
                label: 'Label',
                type: 'text'
            }, {
                name: 'name',
                required: true,
                label: 'Name',
                default: '{{camelCase(context.label)}}',
                type: 'text',
                validate: {
                    pattern: '^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$',
                    min: 3
                }
            }, {
                name: 'description',
                type: 'text',
                label: 'Description',
                required: true
            }, {
                name: 'type',
                label: 'Type',
                type: 'select',
                required: true,
                options: [{
                        label: 'Action',
                        value: 1
                    },
                    {
                        label: 'Universal',
                        value: 12,
                        nested: [{
                            name: 'subtype',
                            label: 'Subtype',
                            type: 'select',
                            options: [{
                                    label: 'REST',
                                    value: 'rest'
                                },
                                {
                                    label: 'GraphQL',
                                    value: 'graphql'
                                }
                            ]
                        }]
                    }
                ]
            }]);
            if (!form) {
                return;
            }
			*/
            // Description prompt
            let description = await vscode.window.showInputBox({ prompt: "Enter module description" })
            if (!Core.isFilled("description", "module", description)) { return }

            // Type prompt
            let type = await vscode.window.showQuickPick(Enum.moduleTypes, { placeHolder: "Pick the module type" })
            if (!Core.isFilled("type", "module", type)) { return }

            // Prepare URI and request body
            let uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${app.name}/${app.version}/${Core.pathDeterminer(_environment.version, 'module')}`
            let body = {
                "name": id,
                "label": label,
                "description": description,
                "type_id": type.description
            }

            // ApiFlip
            if (_environment.version === 2) {
                body.typeId = parseInt(body.type_id);
                delete body.type_id;
            }

            // Action type selector
            if (type.description === "4") {
                let crud = await vscode.window.showQuickPick(Enum.crud, { placeHolder: "Pick the action module type" })
                if (!Core.isFilled("crud", "action", crud)) { return }
                if (crud.label !== "Multipurpose") {
                    body.crud = crud.label.toLowerCase();
                }
            }

            // Universal module subtype prompt
            if(type.description === '12') {
                let subtype = await vscode.window.showQuickPick(Enum.universalModuleSubtypes, { placeHolder: "Pick the subtype for universal module"})
                if (!Core.isFilled("subtype", "module", subtype)) { return }
                body.subtype = subtype.description;
            }

            // Connection / Webhook / No prompt
            switch (type.description) {
                case "1":
                case "4":
                case "9":
                case "12":
                    let connection = await vscode.window.showQuickPick(QuickPick.connections(_environment, _authorization, app, true), { placeHolder: "Pick a connection for the module" })
                    if (!Core.isFilled("connection", "module", connection)) { return }
                    body.connection = connection.label === "--- Without connection ---" ? "" : connection.description
                    break
                case "10":
                    let webhook = await vscode.window.showQuickPick(QuickPick.webhooks(_environment, _authorization, app, false), { placeHolder: "Pick a webhook for the module" })
                    if (!Core.isFilled("webhook", "module", webhook)) { return }
                    body.webhook = webhook.label === "--- Without webhook ---" ? "" : webhook.description
                    break
            }

            // Send the request
            try {
                await Core.addEntity(_authorization, body, uri)
                appsProvider.refresh()
            } catch (err) {
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * Edit module
         */
        vscode.commands.registerCommand('apps-sdk.module.edit-metadata', async function(context) {

            // Context check
            if (!Core.contextGuard(context)) { return }
            const body = {};

            // Label prompt with prefilled value
            let label = await vscode.window.showInputBox({
                prompt: "Customize module label",
                value: context.bareLabel
            })
            if (!Core.isFilled("label", "module", label)) { return }
            body.label = label;

            // Description prompt with prefilled value
            let description = await vscode.window.showInputBox({
                prompt: "Customize module description",
                value: context.bareDescription
            })
            if (!Core.isFilled("description", "module", description)) { return }
            body.description = description

            // Action type selector+
            if (context.type === 4) {
                let crud = await vscode.window.showQuickPick([{ label: "Don't change", description: "keep" }].concat(Enum.crud), { placeHolder: "Change the action type or keep existing." })
                if (!Core.isFilled("crud", "action", crud)) { return }
                if (crud.description !== "keep") {
                    body.crud = crud.label === "Multipurpose" ? undefined : crud.label.toLowerCase();
                } else {
                    body.crud = context.crud;
                }
            }

            body.type_id = context.type

            if (_environment.version === 2) {
                try {
                    body.label = label;
                    delete body.type_id;
                    if (body.crud === null) {
                        delete body.crud;
                    }
                    await Core.patchEntity(_authorization, body, `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}`)
                    appsProvider.refresh()
                } catch (err) {
                    vscode.window.showErrorMessage(err.error.message || err)
                }
            } else {
                // Send the request
                try {
                    await Core.editEntityPlain(_authorization, label, `${_environment.baseUrl}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/label`)
                    await Core.editEntity(_authorization, body, `${_environment.baseUrl}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}`)
                    appsProvider.refresh()
                } catch (err) {
                    vscode.window.showErrorMessage(err.error.message || err)
                }
            }
        })

        /**
         * Change module connection or webhook
         */
        vscode.commands.registerCommand('apps-sdk.module.change-connection-or-webhook', async function(context) {

            // Context check
            if (!Core.contextGuard(context)) { return }

            // Prompt for connection / webhook / nothing -> based on module type and change it
            switch (context.type) {
                case 1:
                case 4:
                case 9:
                    let connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, true);

                    // There's a "Without Connection" option, so that's why there's +1
                    if (connections.length > 2) {
                        let moduleDetail = await Core.rpGet(`${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}`, _authorization);
                        if (_environment.version === 2) {
                            moduleDetail = moduleDetail.appModule
                        }
                        const primaryConnectionOptions = connections;
                        let hasPrimary = !!moduleDetail.connection;
                        if (hasPrimary) {
                            const toSelectIndex = primaryConnectionOptions.findIndex(o => o.description === moduleDetail.connection);
                            const toSelect = primaryConnectionOptions[toSelectIndex];
                            toSelect.label += ` (current)`;
                            toSelect.description = 'keep';
                            primaryConnectionOptions.splice(toSelectIndex, 1);
                            primaryConnectionOptions.unshift(toSelect);
                        } else {
                            const toSelectIndex = primaryConnectionOptions.findIndex(o => o.label === '--- Without connection ---');
                            const toSelect = primaryConnectionOptions[toSelectIndex];
                            toSelect.label += ` (current)`;
                            toSelect.description = 'keep';
                            primaryConnectionOptions.splice(toSelectIndex, 1);
                            primaryConnectionOptions.unshift(toSelect);
                        }
                        let connection = await vscode.window.showQuickPick(primaryConnectionOptions, { placeHolder: "Change primary connection or keep existing." })
                        if (!Core.isFilled("connection", "module", connection)) { return }
                        if (moduleDetail.connection === null && (connection.description === 'keep' || connection.label === '--- Without connection ---')) { return; }
                        if (connection.description !== "keep") {
                            if (connection.label === '--- Without connection ---') {
                                hasPrimary = false;
                            } else {
                                hasPrimary = true;
                            }
                            connection = connection.label === "--- Without connection ---" ? "" : connection.description
                            if (_environment.version === 2) {
                                try {
                                    await Core.patchEntity(_authorization, {
                                        connection: connection
                                    }, `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}`)
                                } catch (err) {
                                    vscode.window.showErrorMessage(err.error.message || err)
                                }
                            } else {
                                try {
                                    await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/connection`)
                                } catch (err) {
                                    vscode.window.showErrorMessage(err.error.message || err)
                                }
                            }
                        }
                        if (!hasPrimary) {
                            appsProvider.refresh();
                            return;
                        }
                        const secondaryConnectionOptions = await QuickPick.connections(_environment, _authorization, context.parent.parent, true);

                        // ApiFlip
                        if (moduleDetail.altConnection !== undefined) {
                            moduleDetail.alt_connection = moduleDetail.altConnection
                        }

                        if (!!moduleDetail.alt_connection) {
                            const toSelectIndex = secondaryConnectionOptions.findIndex(o => o.description === moduleDetail.alt_connection);
                            const toSelect = secondaryConnectionOptions[toSelectIndex];
                            toSelect.label += ` (current)`;
                            toSelect.description = 'keep';
                            secondaryConnectionOptions.splice(toSelectIndex, 1);
                            secondaryConnectionOptions.unshift(toSelect);
                        } else {
                            const toSelectIndex = secondaryConnectionOptions.findIndex(o => o.label === '--- Without connection ---');
                            const toSelect = secondaryConnectionOptions[toSelectIndex];
                            toSelect.label += ` (current)`;
                            toSelect.description = 'keep';
                            secondaryConnectionOptions.splice(toSelectIndex, 1);
                            secondaryConnectionOptions.unshift(toSelect);
                        }
                        connection = await vscode.window.showQuickPick(secondaryConnectionOptions, { placeHolder: "Change secondary connection or keep existing." })
                        if (!Core.isFilled("connection", "module", connection)) { return }
                        if (connection.description !== "keep") {
                            connection = connection.label === "--- Without connection ---" ? "" : connection.description
                            if (_environment.version === 2) {
                                try {
                                    await Core.patchEntity(_authorization, {
                                        altConnection: connection
                                    }, `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}`)
                                } catch (err) {
                                    vscode.window.showErrorMessage(err.error.message || err)
                                }
                            } else {
                                try {
                                    await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/alt_connection`)
                                    appsProvider.refresh()
                                } catch (err) {
                                    vscode.window.showErrorMessage(err.error.message || err)
                                }
                            }
                        }
                        break;
                    } else {
                        connections = [{ label: "Don't change", description: "keep" }].concat(connections)
                        let connection = await vscode.window.showQuickPick(connections, { placeHolder: "Change connection or keep existing." })
                        if (!Core.isFilled("connection", "module", connection)) { return }
                        if (connection.description !== "keep") {
                            connection = connection.label === "--- Without connection ---" ? "" : connection.description
                            if (_environment.version === 2) {
                                try {
                                    await Core.patchEntity(_authorization, {
                                        connection: connection
                                    }, `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}`)
                                } catch (err) {
                                    vscode.window.showErrorMessage(err.error.message || err)
                                }
                            } else {
                                try {
                                    await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/connection`)
                                    appsProvider.refresh()
                                } catch (err) {
                                    vscode.window.showErrorMessage(err.error.message || err)
                                }
                            }
                        }
                        break;
                    }
                case 10:
                    let webhooks = await QuickPick.webhooks(_environment, _authorization, context.parent.parent, false)
                    webhooks = [{ label: "Don't change", description: "keep" }].concat(webhooks)
                    let webhook = await vscode.window.showQuickPick(webhooks, { placeHolder: "Change webhook or keep existing." })
                    if (!Core.isFilled("webhook", "module", webhook)) { return }
                    if (webhook.description !== "keep") {
                        if (_environment.version === 2) {
                            try {
                                await Core.patchEntity(_authorization, {
                                    webhook: webhook.description
                                }, `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}`)
                            } catch (err) {
                                vscode.window.showErrorMessage(err.error.message || err)
                            }
                        } else {
                            try {
                                await Core.editEntityPlain(_authorization, webhook.description, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/webhook`)
                                appsProvider.refresh()
                            } catch (err) {
                                vscode.window.showErrorMessage(err.error.message || err)
                            }
                        }
                    }
                    break
            }
        })

        /**
         * Change module type
         */
        vscode.commands.registerCommand('apps-sdk.module.change-type', async function(context) {

            // Context check
            if (!Core.contextGuard(context)) { return }

            switch (context.type) {
                case 9:
                case 4:
                    let newType = await vscode.window.showQuickPick(Enum.moduleTypeActionSearch, { placeHolder: "Change the type or keep existing." })
                    if (!Core.isFilled("type", "module", module)) { return }
                    if (_environment.version === 2) {
                        if (newType.description !== "keep") {
                            try {
                                await Core.patchEntity(_authorization, {
                                    typeId: parseInt(newType.description)
                                }, `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}`)
                            } catch (err) {
                                vscode.window.showErrorMessage(err.error.message || err)
                            }
                        }
                    } else {
                        if (newType.description !== "keep") {
                            try {
                                await Core.editEntity(_authorization, {
                                    label: context.bareLabel,
                                    description: context.bareDescription,
                                    crud: context.crud,
                                    type_id: newType.description
                                }, `${_environment.baseUrl}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}`)
                                appsProvider.refresh()
                            } catch (err) {
                                vscode.window.showErrorMessage(err.error.message || err)
                            }
                        }
                    }
                    break;
                default:
                    await vscode.window.showInformationMessage(`This type of module can't be changed to any other.`);
                    break;
            }
        })

        /**
         * Module show detail
         */
        vscode.commands.registerCommand('apps-sdk.module.show-detail', async function(context) {

            // If called directly (by using a command pallete) -> die
            if (!Core.contextGuard(context)) { return }

            let module = await Core.rpGet(`${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}`, _authorization)
            if (_environment.version === 2) {
                module = module.appModule;

                module.connection = module.connection ? (await Core.rpGet(`${_environment.baseUrl}/sdk/apps/connections/${module.connection}`, _authorization)).appConnection : null;
                module.alt_connection = module.altConnection ? (await Core.rpGet(`${_environment.baseUrl}/sdk/apps/connections/${module.altConnection}`, _authorization)).appConnection : null;
                module.webhook = module.webhook ? (await Core.rpGet(`${_environment.baseUrl}/sdk/apps/webhooks/${module.webhook}`, _authorization)).appWebhook : null;

                module.type = {
                    id: module.typeId,
                    label: Core.translateModuleTypeId(module.typeId)
                }
                delete module.type_id;
            } else {
                module.connection = module.connection ? await Core.rpGet(`${_environment.baseUrl}/app/${context.parent.parent.name}/connection/${module.connection}`, _authorization) : null;
                module.alt_connection = module.alt_connection ? await Core.rpGet(`${_environment.baseUrl}/app/${context.parent.parent.name}/connection/${module.alt_connection}`, _authorization) : null;
                module.webhook = module.webhook ? await Core.rpGet(`${_environment.baseUrl}/app/${context.parent.parent.name}/webhook/${module.webhook}`, _authorization) : null;

                module.type = {
                    id: module.type_id,
                    label: Core.translateModuleTypeId(module.type_id)
                }
                delete module.type_id;
            }

            const panel = vscode.window.createWebviewPanel(
                `${context.parent.parent.name}_${context.name}_detail`,
                `${context.bareLabel} detail (${context.parent.parent.bareLabel})`,
                vscode.ViewColumn.One, {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            )
            panel.webview.html = Core.getModuleDetailHtml(path.join(__dirname, '..', '..'))
            module.crud = module.crud ? module.crud : 'multipurpose'

            if (fs.existsSync(context.parent.parent.rawIcon.dark)) {
                module.icon = new Buffer(fs.readFileSync(context.parent.parent.rawIcon.dark)).toString('base64')
            } else {
                module.icon = "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIAAQMAAADOtka5AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAADZJREFUeJztwQEBAAAAgiD/r25IQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfBuCAAAB0niJ8AAAAABJRU5ErkJggg=="
            }
            module.theme = context.parent.parent.theme;

            panel.webview.postMessage(module)

        })

        /**
         * Mark module as private
         */
        vscode.commands.registerCommand('apps-sdk.module.visibility.private', async function(context) {

            // Context check
            if (!Core.contextGuard(context)) { return }

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.hide, { placeHolder: `Do you really want to mark this module as private?` })
            if (answer === undefined || answer === null) {
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If was confirmed or not
            switch (answer.label) {
                case "No":
                    vscode.window.showInformationMessage(`The module has been kept as public.`)
                    break
                case "Yes":
                    // Set URI and send the request
                    let uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}/private`
                    try {
                        await Core.executePlain(_authorization, "", uri)
                        appsProvider.refresh()
                    } catch (err) {
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }

        })

        /**
         * Mark module as public
         */
        vscode.commands.registerCommand('apps-sdk.module.visibility.public', async function(context) {

            // Context check
            if (!Core.contextGuard(context)) { return }

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.publish, { placeHolder: `Do you really want to mark this module as public?` })
            if (answer === undefined || answer === null) {
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If was confirmed or not
            switch (answer.label) {
                case "No":
                    vscode.window.showInformationMessage(`The module has been kept as private.`)
                    break
                case "Yes":
                    // Set URI and send the request
                    let uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.parent.parent.name}/${context.parent.parent.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}/public`
                    try {
                        await Core.executePlain(_authorization, "", uri)
                        appsProvider.refresh()
                    } catch (err) {
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }
        })

        /**
         * Clone module
         */
        vscode.commands.registerCommand('apps-sdk.module.clone', async(context) => {
            if (!Core.envGuard(_environment, [2]) || !Core.contextGuard(context)) { return; }

            // Form Data
            const form = await Felicia([{
                name: 'newName',
                label: 'New name',
                type: 'text',
                required: true,
                default: context.name,
                validate: {
                    pattern: '^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$',
                    min: 3
                }
            }]);
            if (!form) {
                return;
            }

            const app = context.parent.parent;
            const uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${app.name}/${app.version}/${Core.pathDeterminer(_environment.version, 'module')}/${context.name}/clone`
            try {
                await Core.addEntity(_authorization, form, uri);
                appsProvider.refresh();
            } catch (err) {
                vscode.window.showErrorMessage(err.error.message || err);
            }

        });
    }
}

module.exports = ModuleCommands