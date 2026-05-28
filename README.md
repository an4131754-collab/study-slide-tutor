# Study Slide Tutor

Study Slide Tutor is a Codex skill for studying English lecture slides in Traditional Chinese.

It is designed for students who receive English classroom slides but want a teaching-assistant style explanation instead of plain translation.

## What It Does

- Accepts a PDF, PPTX, single slide image, or folder of slide images.
- Prepares a stable `manifest.json` with page numbers, extracted text, rendered page images when available, and processing warnings.
- Teaches one page at a time in Traditional Chinese.
- Translates the slide first, then explains it in plain language.
- Keeps important English technical terms.
- Highlights core points, likely exam points, and easy-to-confuse ideas.
- Walks through formulas, algorithms, diagrams, math, physics, networking, and data-structure content step by step.

## Installation

Clone or copy this folder into your Codex skills directory.

On Windows:

```powershell
git clone https://github.com/<your-user>/study-slide-tutor.git C:\Users\USER\.codex\skills\study-slide-tutor
```

Or manually copy the `study-slide-tutor` folder to:

```text
C:\Users\USER\.codex\skills\study-slide-tutor
```

Then restart Codex or open a new thread so the skill list refreshes.

## Usage

In Codex, invoke the skill with a prompt like:

```text
Use $study-slide-tutor to teach me this English lecture deck in Traditional Chinese, page by page.
```

Attach or reference a PDF, PPTX, or image folder.

The skill will first prepare the deck, then teach page 1. Say "next page" or the equivalent phrase in Traditional Chinese to continue.

## PDF Rendering and Poppler

The skill can extract text from many PDFs without extra setup.

For slides with diagrams, formulas, charts, or layout-heavy content, PDF page rendering is much more reliable. On Windows, install Poppler with Scoop:

```powershell
scoop install poppler
```

The bundled preparation script auto-detects common Scoop Poppler paths such as:

```text
C:\Users\USER\scoop\apps\poppler\current\bin
```

You can verify Poppler with:

```powershell
pdftoppm -h
```

## Included Files

```text
study-slide-tutor/
  SKILL.md
  agents/openai.yaml
  scripts/prepare_study_deck.mjs
```

`SKILL.md` contains the tutoring behavior and response rules.

`scripts/prepare_study_deck.mjs` prepares PDFs, PPTX files, and images into a page manifest for stable one-page-at-a-time tutoring.

## Notes

- Default output is chat, not a Markdown notes file.
- The default teaching pace is one page per response.
- The skill may skim the full manifest for context, but it should not explain several pages at once unless explicitly asked.
- If slide text or images are unreadable, the skill should say so instead of guessing.
