"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureGoogleEmbeddingsConfig = ensureGoogleEmbeddingsConfig;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const CONFIG_FILENAME = 'dryconfig.json';
/**
 * Ensures dryconfig.json exists and is configured to use Google embeddings.
 * Creates a new config if it doesn't exist, or modifies existing one.
 */
async function ensureGoogleEmbeddingsConfig(repoPath) {
    const configPath = path.join(repoPath, CONFIG_FILENAME);
    let config;
    try {
        const existingContent = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(existingContent);
    }
    catch {
        // Config doesn't exist, create default
        config = {
            threshold: 0.88,
            minLines: 5,
            excludedPaths: [],
        };
    }
    // Set embedding source to Google
    config.embeddingSource = 'google';
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
