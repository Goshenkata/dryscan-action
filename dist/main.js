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
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = __importStar(require("@actions/github"));
const artifact_1 = require("@actions/artifact");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const pr_comment_1 = require("./pr-comment");
const REPORT_FILENAME = 'dryscan-report.html';
const ARTIFACT_NAME = 'dryscan-report';
async function run() {
    try {
        // Get inputs
        const googleApiKey = core.getInput('google-api-key', { required: true });
        const threshold = parseFloat(core.getInput('threshold', { required: true }));
        const scanPath = core.getInput('path') || '.';
        const githubToken = core.getInput('github-token', { required: false });
        // Mask the API key in logs
        core.setSecret(googleApiKey);
        // Resolve absolute path
        const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
        const absoluteScanPath = path.resolve(workspacePath, scanPath);
        core.info(`Scanning path: ${absoluteScanPath}`);
        core.info(`Threshold: ${threshold}`);
        // Configure dryscan to use Google embeddings
        core.startGroup('Configuring DryScan');
        await (0, config_1.ensureGoogleEmbeddingsConfig)(absoluteScanPath);
        core.info('Configured DryScan to use Google Gemini embeddings');
        core.endGroup();
        // Initialize dryscan
        core.startGroup('Initializing DryScan');
        await exec.exec('npx', ['dryscan', 'init', absoluteScanPath], {
            env: {
                ...process.env,
                GOOGLE_API_KEY: googleApiKey,
            },
        });
        core.endGroup();
        // Run dryscan dupes --json to get the score
        core.startGroup('Running duplicate analysis');
        let jsonOutput = '';
        await exec.exec('npx', ['dryscan', 'dupes', absoluteScanPath, '--json'], {
            env: {
                ...process.env,
                GOOGLE_API_KEY: googleApiKey,
            },
            listeners: {
                stdout: (data) => {
                    jsonOutput += data.toString();
                },
            },
        });
        core.endGroup();
        // Parse the JSON output
        const report = JSON.parse(jsonOutput);
        const score = report.score.score;
        const grade = report.score.grade;
        core.info(`Duplication Score: ${score}`);
        core.info(`Grade: ${grade}`);
        // Generate HTML report
        core.startGroup('Generating HTML report');
        let htmlOutput = '';
        await exec.exec('npx', ['dryscan', 'dupes', absoluteScanPath, '--html'], {
            env: {
                ...process.env,
                GOOGLE_API_KEY: googleApiKey,
            },
            listeners: {
                stdout: (data) => {
                    htmlOutput += data.toString();
                },
            },
        });
        const reportPath = path.join(workspacePath, REPORT_FILENAME);
        await fs.writeFile(reportPath, htmlOutput, 'utf-8');
        core.info(`HTML report saved to ${reportPath}`);
        core.endGroup();
        // Upload artifact
        core.startGroup('Uploading artifact');
        const artifact = new artifact_1.DefaultArtifactClient();
        const { id: artifactId } = await artifact.uploadArtifact(ARTIFACT_NAME, [reportPath], workspacePath, { retentionDays: 30 });
        core.info(`Artifact uploaded with ID: ${artifactId}`);
        core.endGroup();
        // Build artifact URL
        const { owner, repo } = github.context.repo;
        const runId = github.context.runId;
        const artifactUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}/artifacts/${artifactId}`;
        // Determine pass/fail
        const passed = score <= threshold;
        // Set outputs
        core.setOutput('score', score.toString());
        core.setOutput('grade', grade);
        core.setOutput('passed', passed.toString());
        core.setOutput('artifact-url', artifactUrl);
        // Comment on PR if applicable
        if ((0, pr_comment_1.isPullRequest)() && githubToken) {
            core.startGroup('Commenting on PR');
            await (0, pr_comment_1.commentOnPr)({
                token: githubToken,
                score,
                grade,
                threshold,
                passed,
                artifactUrl,
            });
            core.info('PR comment posted');
            core.endGroup();
        }
        // Write job summary
        await writeJobSummary(score, grade, threshold, passed, artifactUrl);
        // Fail if threshold exceeded
        if (!passed) {
            core.setFailed(`Duplication score (${score.toFixed(2)}) exceeds threshold (${threshold}). Grade: ${grade}`);
        }
        else {
            core.info(`✅ Duplication check passed. Score: ${score.toFixed(2)}, Grade: ${grade}`);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(`Action failed: ${error.message}`);
        }
        else {
            core.setFailed('Action failed with an unknown error');
        }
    }
}
async function writeJobSummary(score, grade, threshold, passed, artifactUrl) {
    const statusEmoji = passed ? '✅' : '❌';
    const statusText = passed ? 'Passed' : 'Failed';
    await core.summary
        .addHeading(`${statusEmoji} DryScan Code Duplication Check - ${statusText}`, 2)
        .addTable([
        [
            { data: 'Metric', header: true },
            { data: 'Value', header: true },
        ],
        ['Duplication Score', score.toFixed(2)],
        ['Grade', grade],
        ['Threshold', threshold.toString()],
        ['Status', statusText],
    ])
        .addBreak()
        .addLink('📊 View detailed HTML report', artifactUrl)
        .write();
}
run();
