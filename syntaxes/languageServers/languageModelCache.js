"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
exports.__esModule = true;
function getLanguageModelCache(maxEntries, cleanupIntervalTimeInSec, parse) {
    var languageModels = {};
    var nModels = 0;
    var cleanupInterval = void 0;
    if (cleanupIntervalTimeInSec > 0) {
        cleanupInterval = setInterval(function () {
            var cutoffTime = Date.now() - cleanupIntervalTimeInSec * 1000;
            var uris = Object.keys(languageModels);
            for (var _i = 0, uris_1 = uris; _i < uris_1.length; _i++) {
                var uri = uris_1[_i];
                var languageModelInfo = languageModels[uri];
                if (languageModelInfo.cTime < cutoffTime) {
                    delete languageModels[uri];
                    nModels--;
                }
            }
        }, cleanupIntervalTimeInSec * 1000);
    }
    return {
        get: function (document) {
            var version = document.version;
            var languageId = document.languageId;
            var languageModelInfo = languageModels[document.uri];
            if (languageModelInfo && languageModelInfo.version === version && languageModelInfo.languageId === languageId) {
                languageModelInfo.cTime = Date.now();
                return languageModelInfo.languageModel;
            }
            var languageModel = parse(document);
            languageModels[document.uri] = { languageModel: languageModel, version: version, languageId: languageId, cTime: Date.now() };
            if (!languageModelInfo) {
                nModels++;
            }
            if (nModels === maxEntries) {
                var oldestTime = Number.MAX_VALUE;
                var oldestUri = null;
                for (var uri in languageModels) {
                    var languageModelInfo_1 = languageModels[uri];
                    if (languageModelInfo_1.cTime < oldestTime) {
                        oldestUri = uri;
                        oldestTime = languageModelInfo_1.cTime;
                    }
                }
                if (oldestUri) {
                    delete languageModels[oldestUri];
                    nModels--;
                }
            }
            return languageModel;
        },
        onDocumentRemoved: function (document) {
            var uri = document.uri;
            if (languageModels[uri]) {
                delete languageModels[uri];
                nModels--;
            }
        },
        dispose: function () {
            if (typeof cleanupInterval !== 'undefined') {
                clearInterval(cleanupInterval);
                cleanupInterval = void 0;
                languageModels = {};
                nModels = 0;
            }
        }
    };
}
exports.getLanguageModelCache = getLanguageModelCache;
//# sourceMappingURL=languageModelCache.js.map