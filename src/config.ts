import * as fs from 'fs/promises';
import * as path from 'path';

const CONFIG_FILENAME = 'dryconfig.json';

interface DryConfig {
  excludedPaths?: string[];
  excludedPairs?: string[];
  minLines?: number;
  minBlockLines?: number;
  threshold?: number;
  embeddingModel?: string;
  embeddingSource?: string;
  contextLength?: number;
}

/**
 * Ensures dryconfig.json exists and is configured to use Google embeddings.
 * Creates a new config if it doesn't exist, or modifies existing one.
 */
export async function ensureGoogleEmbeddingsConfig(repoPath: string): Promise<void> {
  const configPath = path.join(repoPath, CONFIG_FILENAME);

  let config: DryConfig;

  try {
    const existingContent = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(existingContent);
  } catch {
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
