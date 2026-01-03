# DryScan GitHub Action

GitHub Action for detecting semantic code duplication using [DryScan](https://github.com/Goshenkata/DryScan). Automatically analyzes your code and fails the build if duplication exceeds your threshold.

## Usage

```yaml
name: DryScan Check
on:
  pull_request:
    branches: [main]

jobs:
  duplication-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    
    steps:
      - name: Set up Node.js 24
        uses: actions/setup-node@v6
        with:
          node-version: 24
      - uses: actions/checkout@v6
      
      - uses: Goshenkata/dryscan-action@v2
        with:
          google-api-key: ${{ secrets.GOOGLE_API_KEY }}
          threshold: 20
          path: '.'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `google-api-key` | Yes | - | Google API key for Gemini embeddings |
| `threshold` | Yes | `20` | Maximum allowed duplication score (0-100) |
| `path` | No | `.` | Path to scan for duplicates |
| `github-token` | No | `${{ github.token }}` | GitHub token for PR comments |

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Duplication score (0-100) |
| `grade` | Grade (Excellent, Good, Fair, Poor, Critical) |
| `passed` | Whether the check passed (true/false) |
| `artifact-url` | URL to the HTML report artifact |

## Features

- ✅ Fails build if duplication exceeds threshold
- 📊 Generates detailed HTML report as artifact
- 💬 Posts results as PR comment
- 📈 Adds job summary with duplication metrics

## License

MIT
