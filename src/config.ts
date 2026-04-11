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
 * Ensures dryconfig.json exists and is configured to use HuggingFace embeddings.
 * Creates a new config if it doesn't exist, or modifies existing one.
 */
export async function ensureHuggingFaceEmbeddingsConfig(repoPath: string): Promise<void> {
  const configPath = path.join(repoPath, CONFIG_FILENAME);

  let config: DryConfig;

  try {
    const existingContent = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(existingContent);
  } catch {
    // Config doesn't exist, create default
    config = {
      excludedPaths: [
        "**/test/**",
      ],
      excludedPairs: [],
      minLines: 3,
      minBlockLines: 5,
      threshold: 0.85,
      embeddingSource: "huggingface",
      contextLength: 2048,
    };
  }

  // Set embedding source to HuggingFace
  config.embeddingSource = 'huggingface';

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
