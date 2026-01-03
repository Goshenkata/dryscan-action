import * as github from '@actions/github';

interface CommentParams {
  token: string;
  score: number;
  grade: string;
  threshold: number;
  passed: boolean;
  artifactUrl: string;
}

/**
 * Posts or updates a comment on the PR with DryScan results.
 */
export async function commentOnPr(params: CommentParams): Promise<void> {
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
    : `⚠️ Code duplication score (${score.toFixed(2)}) exceeds threshold (${threshold}). Please review and reduce duplicate code.`
  }

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

  const existingComment = comments.find(
    (comment) => comment.body?.includes(commentMarker)
  );

  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: bodyWithMarker,
    });
  } else {
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
export function isPullRequest(): boolean {
  return !!github.context.payload.pull_request;
}
