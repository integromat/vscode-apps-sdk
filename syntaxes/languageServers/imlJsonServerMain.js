"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
exports.__esModule = true;
var vscode_languageserver_1 = require("vscode-languageserver");
var request_light_1 = require("request-light");
var fs = require("fs");
var vscode_uri_1 = require("vscode-uri");
var URL = require("url");
var strings_1 = require("./utils/strings");
var runner_1 = require("./utils/runner");
var vscode_json_languageservice_1 = require("vscode-json-languageservice");
var languageModelCache_1 = require("./languageModelCache");
var SchemaAssociationNotification;
(function (SchemaAssociationNotification) {
    SchemaAssociationNotification.type = new vscode_languageserver_1.NotificationType('imljson/schemaAssociations');
})(SchemaAssociationNotification || (SchemaAssociationNotification = {}));
var VSCodeContentRequest;
(function (VSCodeContentRequest) {
    VSCodeContentRequest.type = new vscode_languageserver_1.RequestType('vscode/content');
})(VSCodeContentRequest || (VSCodeContentRequest = {}));
var SchemaContentChangeNotification;
(function (SchemaContentChangeNotification) {
    SchemaContentChangeNotification.type = new vscode_languageserver_1.NotificationType('imljson/schemaContent');
})(SchemaContentChangeNotification || (SchemaContentChangeNotification = {}));
// Create a connection for the server
var connection = vscode_languageserver_1.createConnection();
process.on('unhandledRejection', function (e) {
    console.error(runner_1.formatError("Unhandled exception", e));
});
process.on('uncaughtException', function (e) {
    console.error(runner_1.formatError("Unhandled exception", e));
});
console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);
var workspaceContext = {
    resolveRelativePath: function (relativePath, resource) {
        return URL.resolve(resource, relativePath);
    }
};
var schemaRequestService = function (uri) {
    if (strings_1.startsWith(uri, 'file://')) {
        var fsPath_1 = vscode_uri_1["default"].parse(uri).fsPath;
        return new Promise(function (c, e) {
            fs.readFile(fsPath_1, 'UTF-8', function (err, result) {
                err ? e(err.message || err.toString()) : c(result.toString());
            });
        });
    }
    else if (strings_1.startsWith(uri, 'vscode://')) {
        return connection.sendRequest(VSCodeContentRequest.type, uri).then(function (responseText) {
            return responseText;
        }, function (error) {
            return Promise.reject(error.message);
        });
    }
    if (uri.indexOf('//schema.management.azure.com/') !== -1) {
        /* __GDPR__
            "json.schema" : {
                "schemaURL" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
            }
         */
        connection.telemetry.logEvent({
            key: 'json.schema',
            value: {
                schemaURL: uri
            }
        });
    }
    var headers = { 'Accept-Encoding': 'gzip, deflate' };
    return request_light_1.xhr({ url: uri, followRedirects: 5, headers: headers }).then(function (response) {
        return response.responseText;
    }, function (error) {
        return Promise.reject(error.responseText || request_light_1.getErrorStatusDescription(error.status) || error.toString());
    });
};
// create the JSON language service
var languageService = vscode_json_languageservice_1.getLanguageService({
    schemaRequestService: schemaRequestService,
    workspaceContext: workspaceContext,
    contributions: []
});
// Create a simple text document manager. The text document manager
// supports full document sync only
var documents = new vscode_languageserver_1.TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
var clientSnippetSupport = false;
var clientDynamicRegisterSupport = false;
var foldingRangeLimit = Number.MAX_VALUE;
var hierarchicalDocumentSymbolSupport = false;
// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities.
connection.onInitialize(function (params) {
    languageService = vscode_json_languageservice_1.getLanguageService({
        schemaRequestService: schemaRequestService,
        workspaceContext: workspaceContext,
        contributions: [],
        clientCapabilities: params.capabilities
    });
    function getClientCapability(name, def) {
        var keys = name.split('.');
        var c = params.capabilities;
        for (var i = 0; c && i < keys.length; i++) {
            if (!c.hasOwnProperty(keys[i])) {
                return def;
            }
            c = c[keys[i]];
        }
        return c;
    }
    clientSnippetSupport = getClientCapability('textDocument.completion.completionItem.snippetSupport', false);
    clientDynamicRegisterSupport = getClientCapability('workspace.symbol.dynamicRegistration', false);
    foldingRangeLimit = getClientCapability('textDocument.foldingRange.rangeLimit', Number.MAX_VALUE);
    hierarchicalDocumentSymbolSupport = getClientCapability('textDocument.documentSymbol.hierarchicalDocumentSymbolSupport', false);
    var capabilities = {
        // Tell the client that the server works in FULL text document sync mode
        textDocumentSync: documents.syncKind,
        completionProvider: clientSnippetSupport ? { resolveProvider: true, triggerCharacters: ['"', ':'] } : void 0,
        hoverProvider: true,
        documentSymbolProvider: true,
        documentRangeFormattingProvider: false,
        colorProvider: {},
        foldingRangeProvider: true
    };
    return { capabilities: capabilities };
});
var jsonConfigurationSettings = void 0;
var schemaAssociations = void 0;
var formatterRegistration = null;
// The settings have changed. Is send on server activation as well.
connection.onDidChangeConfiguration(function (change) {
    var settings = change.settings;
    request_light_1.configure(settings.http && settings.http.proxy, settings.http && settings.http.proxyStrictSSL);
    jsonConfigurationSettings = settings.json && settings.json.schemas;
    updateConfiguration();
    // dynamically enable & disable the formatter
    if (clientDynamicRegisterSupport) {
        var enableFormatter = settings && settings.json && settings.json.format && settings.json.format.enable;
        if (enableFormatter) {
            if (!formatterRegistration) {
                formatterRegistration = connection.client.register(vscode_languageserver_1.DocumentRangeFormattingRequest.type, { documentSelector: [{ language: 'imljson' }] });
            }
        }
        else if (formatterRegistration) {
            formatterRegistration.then(function (r) { return r.dispose(); });
            formatterRegistration = null;
        }
    }
});
// The jsonValidation extension configuration has changed
connection.onNotification(SchemaAssociationNotification.type, function (associations) {
    schemaAssociations = associations;
    updateConfiguration();
});
// A schema has changed
connection.onNotification(SchemaContentChangeNotification.type, function (uri) {
    languageService.resetSchema(uri);
});
function updateConfiguration() {
    var languageSettings = {
        validate: true,
        allowComments: true,
        schemas: new Array()
    };
    if (schemaAssociations) {
        for (var pattern in schemaAssociations) {
            var association = schemaAssociations[pattern];
            if (Array.isArray(association)) {
                association.forEach(function (uri) {
                    languageSettings.schemas.push({ uri: uri, fileMatch: [pattern] });
                });
            }
        }
    }
    if (jsonConfigurationSettings) {
        jsonConfigurationSettings.forEach(function (schema, index) {
            var uri = schema.url;
            if (!uri && schema.schema) {
                uri = schema.schema.id || "vscode://schemas/custom/" + index;
            }
            if (uri) {
                languageSettings.schemas.push({ uri: uri, fileMatch: schema.fileMatch, schema: schema.schema });
            }
        });
    }
    languageService.configure(languageSettings);
    // Revalidate any open text documents
    documents.all().forEach(triggerValidation);
}
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(function (change) {
    triggerValidation(change.document);
});
// a document has closed: clear all diagnostics
documents.onDidClose(function (event) {
    cleanPendingValidation(event.document);
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});
var pendingValidationRequests = {};
var validationDelayMs = 500;
function cleanPendingValidation(textDocument) {
    var request = pendingValidationRequests[textDocument.uri];
    if (request) {
        clearTimeout(request);
        delete pendingValidationRequests[textDocument.uri];
    }
}
function triggerValidation(textDocument) {
    cleanPendingValidation(textDocument);
    pendingValidationRequests[textDocument.uri] = setTimeout(function () {
        delete pendingValidationRequests[textDocument.uri];
        validateTextDocument(textDocument);
    }, validationDelayMs);
}
function validateTextDocument(textDocument) {
    if (textDocument.getText().length === 0) {
        // ignore empty documents
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
        return;
    }
    var jsonDocument = getJSONDocument(textDocument);
    var version = textDocument.version;
    var documentSettings = { comments: 'ignore', trailingCommas: 'error' }
    languageService.doValidation(textDocument, jsonDocument, documentSettings).then(function (diagnostics) {
        setTimeout(function () {
            var currDocument = documents.get(textDocument.uri);
            if (currDocument && currDocument.version === version) {
                // Send the computed diagnostics to VSCode.
                connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: diagnostics });
            }
        }, 100);
    }, function (error) {
        connection.console.error(runner_1.formatError("Error while validating " + textDocument.uri, error));
    });
}
connection.onDidChangeWatchedFiles(function (change) {
    // Monitored files have changed in VSCode
    var hasChanges = false;
    change.changes.forEach(function (c) {
        if (languageService.resetSchema(c.uri)) {
            hasChanges = true;
        }
    });
    if (hasChanges) {
        documents.all().forEach(triggerValidation);
    }
});
var jsonDocuments = languageModelCache_1.getLanguageModelCache(10, 60, function (document) { return languageService.parseJSONDocument(document); });
documents.onDidClose(function (e) {
    jsonDocuments.onDocumentRemoved(e.document);
});
connection.onShutdown(function () {
    jsonDocuments.dispose();
});
function getJSONDocument(document) {
    return jsonDocuments.get(document);
}
connection.onCompletion(function (textDocumentPosition, token) {
    return runner_1.runSafeAsync(function () {
        return __awaiter(_this, void 0, void 0, function () {
            var document, jsonDocument;
            return __generator(this, function (_a) {
                document = documents.get(textDocumentPosition.textDocument.uri);
                if (document) {
                    jsonDocument = getJSONDocument(document);
                    return [2 /*return*/, languageService.doComplete(document, textDocumentPosition.position, jsonDocument)];
                }
                return [2 /*return*/, null];
            });
        });
    }, null, "Error while computing completions for " + textDocumentPosition.textDocument.uri, token);
});
connection.onCompletionResolve(function (completionItem, token) {
    return runner_1.runSafeAsync(function () {
        return languageService.doResolve(completionItem);
    }, completionItem, "Error while resolving completion proposal", token);
});
connection.onHover(function (textDocumentPositionParams, token) {
    return runner_1.runSafeAsync(function () {
        return __awaiter(_this, void 0, void 0, function () {
            var document, jsonDocument;
            return __generator(this, function (_a) {
                document = documents.get(textDocumentPositionParams.textDocument.uri);
                if (document) {
                    jsonDocument = getJSONDocument(document);
                    return [2 /*return*/, languageService.doHover(document, textDocumentPositionParams.position, jsonDocument)];
                }
                return [2 /*return*/, null];
            });
        });
    }, null, "Error while computing hover for " + textDocumentPositionParams.textDocument.uri, token);
});
connection.onDocumentSymbol(function (documentSymbolParams, token) {
    return runner_1.runSafe(function () {
        var document = documents.get(documentSymbolParams.textDocument.uri);
        if (document) {
            var jsonDocument = getJSONDocument(document);
            if (hierarchicalDocumentSymbolSupport) {
                return languageService.findDocumentSymbols2(document, jsonDocument);
            }
            else {
                return languageService.findDocumentSymbols(document, jsonDocument);
            }
        }
        return [];
    }, [], "Error while computing document symbols for " + documentSymbolParams.textDocument.uri, token);
});
connection.onDocumentRangeFormatting(function (formatParams, token) {
    return runner_1.runSafe(function () {
        var document = documents.get(formatParams.textDocument.uri);
        if (document) {
            return languageService.format(document, formatParams.range, formatParams.options);
        }
        return [];
    }, [], "Error while formatting range for " + formatParams.textDocument.uri, token);
});
connection.onDocumentColor(function (params, token) {
    return runner_1.runSafeAsync(function () {
        return __awaiter(_this, void 0, void 0, function () {
            var document, jsonDocument;
            return __generator(this, function (_a) {
                document = documents.get(params.textDocument.uri);
                if (document) {
                    jsonDocument = getJSONDocument(document);
                    return [2 /*return*/, languageService.findDocumentColors(document, jsonDocument)];
                }
                return [2 /*return*/, []];
            });
        });
    }, [], "Error while computing document colors for " + params.textDocument.uri, token);
});
connection.onColorPresentation(function (params, token) {
    return runner_1.runSafe(function () {
        var document = documents.get(params.textDocument.uri);
        if (document) {
            var jsonDocument = getJSONDocument(document);
            return languageService.getColorPresentations(document, jsonDocument, params.color, params.range);
        }
        return [];
    }, [], "Error while computing color presentations for " + params.textDocument.uri, token);
});
connection.onFoldingRanges(function (params, token) {
    return runner_1.runSafe(function () {
        var document = documents.get(params.textDocument.uri);
        if (document) {
            return languageService.getFoldingRanges(document, { rangeLimit: foldingRangeLimit });
        }
        return null;
    }, null, "Error while computing folding ranges for " + params.textDocument.uri, token);
});
// Listen on the connection
connection.listen();
//# sourceMappingURL=jsonServerMain.js.map