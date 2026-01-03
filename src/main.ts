import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { DefaultArtifactClient } from '@actions/artifact';
import * as fs from 'fs/promises';
import * as path from 'path';

import { ensureGoogleEmbeddingsConfig } from './config';
import { commentOnPr, isPullRequest } from './pr-comment';

const REPORT_FILENAME = 'dryscan-report.html';
const ARTIFACT_NAME = 'dryscan-report';

interface DuplicationScore {
  score: number;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  totalLines: number;
  duplicateLines: number;
  duplicateGroups: number;
}

interface DuplicateReport {
  version: number;
  generatedAt: string;
  threshold: number;
  grade: DuplicationScore['grade'];
  score: DuplicationScore;
  duplicates: unknown[];
}

async function run(): Promise<void> {
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
    await ensureGoogleEmbeddingsConfig(absoluteScanPath);
    core.info('Configured DryScan to use Google Gemini embeddings');
    core.endGroup();

    // Initialize dryscan
    core.startGroup('Initializing DryScan');
    await exec.exec('npx', ['@goshenkata/dryscan-cli@1.0.12', 'init', absoluteScanPath], {
      env: {
        ...process.env,
        GOOGLE_API_KEY: googleApiKey,
      },
    });
    core.endGroup();

    // Run dryscan dupes --json to get the score
    core.startGroup('Running duplicate analysis');
    let jsonOutput = '';
    await exec.exec('npx', ['@goshenkata/dryscan-cli@1.0.12', 'dupes', absoluteScanPath, '--json'], {
      env: {
        ...process.env,
        GOOGLE_API_KEY: googleApiKey,
      },
      listeners: {
        stdout: (data: Buffer) => {
          jsonOutput += data.toString();
        },
      },
    });
    core.endGroup();

    // Parse the JSON output
    const report: DuplicateReport = JSON.parse(jsonOutput);
    const score = report.score.score;
    const grade = report.score.grade;

    core.info(`Duplication Score: ${score}`);
    core.info(`Grade: ${grade}`);

    // Generate HTML report
    core.startGroup('Generating HTML report');
    let htmlOutput = '';
    await exec.exec('npx', ['@goshenkata/dryscan-cli@1.0.12', 'dupes', absoluteScanPath, '--html'], {
      env: {
        ...process.env,
        GOOGLE_API_KEY: googleApiKey,
      },
      listeners: {
        stdout: (data: Buffer) => {
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
    const artifact = new DefaultArtifactClient();
    const { id: artifactId } = await artifact.uploadArtifact(
      ARTIFACT_NAME,
      [reportPath],
      workspacePath,
      { retentionDays: 30 }
    );
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
    if (isPullRequest() && githubToken) {
      core.startGroup('Commenting on PR');
      await commentOnPr({
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
      core.setFailed(
        `Duplication score (${score.toFixed(2)}) exceeds threshold (${threshold}). Grade: ${grade}`
      );
    } else {
      core.info(`✅ Duplication check passed. Score: ${score.toFixed(2)}, Grade: ${grade}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Action failed: ${error.message}`);
    } else {
      core.setFailed('Action failed with an unknown error');
    }
  }
}

async function writeJobSummary(
  score: number,
  grade: string,
  threshold: number,
  passed: boolean,
  artifactUrl: string
): Promise<void> {
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
