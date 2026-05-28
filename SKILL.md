---
name: study-slide-tutor
description: "Teach English lecture slides, classroom decks, PDFs, PPTX files, screenshots, or folders of slide images in Traditional Chinese. Use when the user wants an AI teaching assistant for English course materials, not just translation: page-by-page translation, plain-language explanation, retained English terminology, exam points, confusion traps, and step-by-step formula, algorithm, networking, data structure, physics, or math walkthroughs."
---

# Study Slide Tutor

## Goal

Turn an English lecture deck into a Traditional Chinese tutoring session. Optimize for understanding, homework, and exam preparation rather than literal translation only.

Use the bundled script first when the user provides a PDF, PPTX, or image folder:

```bash
node <skill-dir>/scripts/prepare_study_deck.mjs --input <file-or-folder> --out-dir <workspace-output-dir>
```

The script writes `manifest.json` with page numbers, slide/page images when available, extracted text when available, and warnings for degraded extraction or rendering.

## Workflow

1. Prepare the source with `prepare_study_deck.mjs`.
   - PDF: extract page text and render page PNGs when Poppler is available.
   - PPTX: render slide PNGs with bundled `@oai/artifact-tool` when possible; also extract slide text from the PPTX package.
   - Image folder: sort images naturally by filename and treat each image as one slide page.
   - Single image: treat it as page 1.
2. Read `manifest.json` before teaching.
3. Skim all page records in the manifest once to understand the deck flow, titles, repeated pages, and upcoming context.
4. Teach only one page per response by default, even if the manifest contains many pages.
5. When the user asks to continue or go to the next page in English or Traditional Chinese, continue with exactly the next page.
6. Do not create a Markdown notes file unless the user asks. Default output is chat.

## Output Style

Use Traditional Chinese for the tutoring response.

Keep the layout airy:

- Use short paragraphs.
- Put a blank line between sections.
- Avoid dense bullet walls.
- Prefer 2-4 high-value bullets per section.
- If a page is simple, keep the answer short.

Do not output several pages at once unless the user explicitly asks for a range.

## One-Page Tutoring Format

For a substantive page, use this structure. Section headings and all explanations must be written in Traditional Chinese:

```markdown
## Page N heading in Traditional Chinese

### Full translation heading in Traditional Chinese

Translate the visible English into natural Traditional Chinese. Preserve important English terms in parentheses or inline.

### Plain-language explanation heading in Traditional Chinese

Explain what the slide is really saying as if the user asked what this page is doing.

### Core points heading in Traditional Chinese

- ...

### Important English terms heading in Traditional Chinese

- English term: Traditional Chinese explanation

### Possible exam points heading in Traditional Chinese

- ...

### Easy-to-confuse points heading in Traditional Chinese

- ...
```

Add a Traditional Chinese section for formula, algorithm, or process walkthrough only when the page contains formulas, algorithms, procedures, network flows, data structures, physics, or math. Do not skip steps. Use concrete numbers when possible.

For low-information pages, use a much shorter response:

```markdown
## Page N heading in Traditional Chinese

One short Traditional Chinese sentence saying the page has little substantive content, followed by the summary.
```

## Teaching Rules

- Keep important technical terms in English, especially terms likely to appear in homework, exams, APIs, code, or diagrams.
- Do not assume the user already knows prerequisite background.
- When a concept is abstract, add a daily-life analogy or a small numeric example.
- When explaining formulas, state what each symbol means, where each number comes from, and how the calculation proceeds.
- When explaining algorithms or flows, run at least one small example input through the process.
- When explaining diagrams, describe arrow direction, stages, labels, and what changes at each step.
- When two ideas are easy to confuse, compare them directly.
- If text in an image is unreadable, say so directly and do not guess.
- If extracted text conflicts with the slide image, trust the image and mention the mismatch.

## Page State

When using a manifest, keep track of:

- manifest path
- source filename
- total pages
- current page
- next page
- whether each page has `imagePath`, extracted text, or warnings

At the end of every page, include one short Traditional Chinese continuation sentence saying:

- the current page number
- that the user can ask for the next page to continue
- whether the next page is already prepared

## Script Notes

`scripts/prepare_study_deck.mjs` is a preparation utility, not the tutor itself. It should be used to reduce manual screenshot work and produce stable page references before teaching.

If PDF rendering fails:

- Check whether Poppler is available.
- Prefer the script's auto-detected Poppler path, especially Scoop installs under the user profile.
- Continue with extracted text when enough information exists.
- If visuals, charts, equations, or layout are important and no slide images are available, ask the user to provide a PDF export or screenshots for the affected pages.
- Never claim that a page has no content merely because extraction failed.
