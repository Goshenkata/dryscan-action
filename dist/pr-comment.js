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
exports.commentOnPr = commentOnPr;
exports.isPullRequest = isPullRequest;
const github = __importStar(require("@actions/github"));
/**
 * Posts or updates a comment on the PR with DryScan results.
 */
async function commentOnPr(params) {
    const { token, score, grade, threshold, passed, artifactUrl } = params;
    const context = github.context;
    if (!context.payload.pull_request) {
        return; // Not a PR, nothing to comment on
    }
    const octokit = github.getOctokit(token);
    const prNumber = context.payload.pull_request.number;
    const { owner, repo } = context.repo;
    const statusEmoji = passed ? '✅' : '❌';
    const statusText = passed ? 'Passed' : 'Failed';
    const body = `## ${statusEmoji} DryScan Code Duplication Check - ${statusText}

| Metric | Value |
|--------|-------|
| **Duplication Score** | ${score.toFixed(2)} |
| **Grade** | ${grade} |
| **Threshold** | ${threshold} |
| **Status** | ${statusText} |

${passed
        ? '🎉 Great job! Your code duplication is within acceptable limits.'
        : `⚠️ Code duplication score (${score.toFixed(2)}) exceeds threshold (${threshold}). Please review and reduce duplicate code.`}

📊 [View detailed HTML report](${artifactUrl})

---
*Powered by [DryScan](https://github.com/Goshenkata/DryScan)*`;
    const commentMarker = '<!-- dryscan-action-comment -->';
    const bodyWithMarker = `${commentMarker}\n${body}`;
    // Check if we already have a comment from this action
    const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
    });
    const existingComment = comments.find((comment) => comment.body?.includes(commentMarker));
    if (existingComment) {
        await octokit.rest.issues.updateComment({
            owner,
            repo,
            comment_id: existingComment.id,
            body: bodyWithMarker,
        });
    }
    else {
        await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: prNumber,
            body: bodyWithMarker,
        });
    }
}
/**
 * Checks if the current workflow is running in a PR context.
 */
function isPullRequest() {
    return !!github.context.payload.pull_request;
}
