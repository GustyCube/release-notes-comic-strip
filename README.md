# Release Notes Comic Strip

![alt text](image.png)
> Note: This uses DALLE-3, which isn't as good for text processing, but `gpt-image-1` wasn't available to me.

**🏆 For The Love of Code 2025 Hackathon Submission**

Turns merged PRs between releases into a 4-panel comic strip and attaches it to your GitHub release.

## How it works
1. Collects merged PRs between two tags
2. **Planner** (GPT-4o) analyzes PR titles, descriptions, labels, and authors to create a comic narrative
3. **Image gen** (DALL-E 3) renders 4 comic-style panels with speech bubbles and visual effects
4. **Composer** stitches panels into a comic strip with PR titles above each panel

## What's New
- **Full PR analysis**: Uses PR body content, labels, and metadata (not just titles)
- **True comic styling**: Speech bubbles with dialogue, comic borders, sound effects (POW!, ZAP!)
- **PR titles displayed**: Each panel shows `#123: Fix login bug` in yellow caption boxes
- **No fallback mode**: Requires OpenAI API for quality (removed SVG fallback)

## Inputs
- `from`: start tag (defaults to previous tag)
- `to`: end tag (defaults to current tag)
- `style`: art style (`comic`, `retro`, `modern`)
- `persona`: dialogue tone (`friendly`, `witty`, `professional`)
- `attach_as`: output filename (default `release-comic.png`)

## Required Secrets
- `OPENAI_API_KEY`: For GPT-4o and DALL-E 3
- `GITHUB_TOKEN`: For PR access and release uploads

## Local test
```bash
npm install
npm run build
export OPENAI_API_KEY="your-key"
npm run test:local
```

Edit `local/test.json` with sample PRs:
```json
{
  "prs": [{
    "number": 101,
    "title": "Fix flaky login",
    "body": "Fixed race condition...",
    "labels": [{"name": "bug"}]
  }],
  "style": "comic",
  "persona": "friendly"
}
```

Output: `local/out/comic-1x4.png`

## Notes
- Always generates exactly 4 panels in one row
- Each panel is 1024×1024px
- Final strip is ~4096×1024px with borders and titles

---
*Transform your commits into comics! 🎨*
