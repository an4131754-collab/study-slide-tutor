#!/usr/bin/env node

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"]);

function usage() {
  return [
    "Usage:",
    "  node prepare_study_deck.mjs --input <file-or-folder> --out-dir <dir> [options]",
    "",
    "Options:",
    "  --batch-size <n>          Suggested teaching batch size. Defaults to 1.",
    "  --render-pdf <mode>       auto, never, or always. Defaults to auto.",
    "  --dpi <n>                 PDF render DPI when rendering is available. Defaults to 160.",
    "  --scale <n>               PPTX render scale. Defaults to 1.",
    "  --python <path>           Python executable for PDF/PPTX text extraction.",
    "  --poppler-path <dir>      Directory containing Poppler binaries such as pdftoppm/pdfinfo.",
    "  --markdown-mode <mode>    auto, never, or always. Defaults to auto.",
    "  --markitdown-command <p>  Executable path/name for MarkItDown. Defaults to auto-detection.",
    "  --markitdown-source <dir> Local microsoft/markitdown source checkout or packages/markitdown dir.",
    "  --node-modules <path>     node_modules directory containing @oai/artifact-tool.",
    "  --help                    Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    if (key === "help") {
      args.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function requireArg(args, name) {
  const value = args[name];
  if (!value) {
    throw new Error(`Missing --${name}`);
  }
  return value;
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function statPath(filePath) {
  return fs.stat(filePath).catch(() => undefined);
}

function naturalCompare(a, b) {
  return new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare(a, b);
}

function commandExists(commandName) {
  const finder = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(finder, [commandName], { encoding: "utf8" });
  if (result.status !== 0) return "";
  return String(result.stdout).split(/\r?\n/).find(Boolean)?.trim() || "";
}

function userHome() {
  return process.env.USERPROFILE || process.env.HOME || "";
}

function bundledPythonCandidate() {
  const home = userHome();
  if (!home) return "";
  return path.join(
    home,
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "python",
    process.platform === "win32" ? "python.exe" : "bin/python",
  );
}

function bundledNodeModulesCandidate() {
  const home = userHome();
  if (!home) return "";
  return path.join(
    home,
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "node",
    "node_modules",
  );
}

function findPython(explicitPython) {
  const candidates = [
    explicitPython,
    process.env.CODEX_PYTHON,
    process.env.PYTHON,
    bundledPythonCandidate(),
    "python",
    "python3",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  return "";
}

function pythonCanUseMarkitdownApi(python) {
  if (!python) return false;
  const result = spawnSync(
    python,
    ["-c", "from markitdown import MarkItDown"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
    },
  );
  return result.status === 0;
}

function commandExistsInDir(directory, commandName) {
  if (!directory) return false;
  const names = process.platform === "win32"
    ? [`${commandName}.exe`, `${commandName}.cmd`, commandName]
    : [commandName];
  return names.some((name) => fsSync.existsSync(path.join(directory, name)));
}

function findPopplerPath(explicitPopplerPath) {
  const home = userHome();
  const candidates = [
    explicitPopplerPath,
    process.env.POPPLER_PATH,
    process.env.POPPLER_BIN,
    home ? path.join(home, "scoop", "apps", "poppler", "current", "bin") : "",
    home ? path.join(home, "scoop", "apps", "poppler", "current", "Library", "bin") : "",
    home ? path.join(home, "scoop", "shims") : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (commandExistsInDir(resolved, "pdftoppm") && commandExistsInDir(resolved, "pdfinfo")) {
      return resolved;
    }
  }

  const whereCommand = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(whereCommand, ["pdftoppm"], { encoding: "utf8" });
  if (result.status === 0) {
    const found = String(result.stdout).split(/\r?\n/).find(Boolean);
    if (found) return path.dirname(found.trim());
  }

  return "";
}

function resolveMarkitdownPackageDir(candidate) {
  if (!candidate) return "";
  const resolved = path.resolve(candidate);
  const directPyproject = path.join(resolved, "pyproject.toml");
  const directSrc = path.join(resolved, "src", "markitdown", "__init__.py");
  if (fsSync.existsSync(directPyproject) && fsSync.existsSync(directSrc)) {
    return resolved;
  }

  const packageDir = path.join(resolved, "packages", "markitdown");
  const packagePyproject = path.join(packageDir, "pyproject.toml");
  const packageSrc = path.join(packageDir, "src", "markitdown", "__init__.py");
  if (fsSync.existsSync(packagePyproject) && fsSync.existsSync(packageSrc)) {
    return packageDir;
  }

  return "";
}

function findLocalMarkitdownSource(explicitSource) {
  const cwd = process.cwd();
  const candidates = [
    explicitSource,
    process.env.MARKITDOWN_SOURCE,
    path.join(cwd, "markitdown"),
    path.join(cwd, "markitdown", "packages", "markitdown"),
    path.join(cwd, "..", "markitdown"),
    path.join(cwd, "..", "markitdown", "packages", "markitdown"),
  ];

  for (const candidate of candidates) {
    const packageDir = resolveMarkitdownPackageDir(candidate);
    if (packageDir) return packageDir;
  }

  return "";
}

function runPythonJson(python, script, args) {
  if (!python) {
    return { ok: false, error: "No usable Python executable found." };
  }
  const result = spawnSync(python, ["-c", script, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    },
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.stderr || result.stdout || "Python command failed.").trim(),
    };
  }
  try {
    return { ok: true, value: JSON.parse(result.stdout) };
  } catch (error) {
    return { ok: false, error: `Could not parse Python JSON output: ${error.message}` };
  }
}

async function importArtifactTool(explicitNodeModules) {
  const require = createRequire(import.meta.url);
  const candidates = [
    explicitNodeModules,
    process.env.CODEX_NODE_MODULES,
    process.env.NODE_MODULES,
    bundledNodeModulesCandidate(),
    process.cwd(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const resolved = require.resolve("@oai/artifact-tool", { paths: [candidate] });
      return await import(pathToFileURL(resolved).href);
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error("Could not resolve @oai/artifact-tool. Pass --node-modules or use a Codex bundled runtime.");
}

function slidesFromPresentation(presentation) {
  if (Array.isArray(presentation.slides?.items)) return presentation.slides.items;
  if (Number.isInteger(presentation.slides?.count) && typeof presentation.slides.getItem === "function") {
    return Array.from({ length: presentation.slides.count }, (_, index) => presentation.slides.getItem(index));
  }
  throw new Error("Could not enumerate PPTX slides after import.");
}

async function saveBlobToFile(blob, filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (typeof blob.save === "function") {
    await blob.save(filePath);
    return;
  }
  if (typeof blob.arrayBuffer === "function") {
    await fs.writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
    return;
  }
  if (Buffer.isBuffer(blob)) {
    await fs.writeFile(filePath, blob);
    return;
  }
  throw new Error("Unsupported blob returned by artifact-tool export.");
}

function markitdownTimeoutMs() {
  const raw = process.env.STUDY_SLIDE_TUTOR_MARKITDOWN_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : 120000;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 120000;
}

function markitdownExtraForInput(inputPath) {
  const extension = path.extname(inputPath).toLowerCase();
  if (extension === ".pdf") return "pdf";
  if (extension === ".pptx") return "pptx";
  return "all";
}

function buildMarkitdownAttempts(inputPath, markdownPath, options) {
  const attempts = [];
  const python = findPython(options.python);
  const extra = markitdownExtraForInput(inputPath);
  if (options.command) {
    attempts.push({
      label: options.command,
      command: options.command,
      args: [inputPath, "-o", markdownPath],
    });
  }

  const uv = commandExists("uv");
  const localSource = findLocalMarkitdownSource(options.source);
  if (uv && localSource) {
    const pythonArgs = python ? ["--python", python, "--no-python-downloads"] : [];
    attempts.push({
      label: `uv run local MarkItDown source (${extra} extra)`,
      command: uv,
      args: [
        "run",
        "--project",
        localSource,
        ...pythonArgs,
        "--extra",
        extra,
        "markitdown",
        inputPath,
        "-o",
        markdownPath,
      ],
      env: {
        MARKITDOWN_SOURCE: localSource,
      },
    });
  }

  const markitdown = commandExists("markitdown");
  if (markitdown) {
    attempts.push({
      label: "markitdown",
      command: markitdown,
      args: [inputPath, "-o", markdownPath],
    });
  }

  if (pythonCanUseMarkitdownApi(python)) {
    const apiScript = [
      "import sys",
      "from markitdown import MarkItDown",
      "result = MarkItDown(enable_plugins=False).convert(sys.argv[1])",
      "text = getattr(result, 'text_content', None) or getattr(result, 'markdown', None) or str(result)",
      "open(sys.argv[2], 'w', encoding='utf-8').write(text)",
    ].join("; ");
    attempts.push({
      label: "python MarkItDown API",
      command: python,
      args: ["-c", apiScript, inputPath, markdownPath],
    });
  }

  const uvx = commandExists("uvx");
  if (uvx) {
    attempts.push({
      label: `uvx --from markitdown[${extra}] markitdown`,
      command: uvx,
      args: ["--from", `markitdown[${extra}]`, "markitdown", inputPath, "-o", markdownPath],
    });
  }

  return attempts;
}

async function prepareMarkdown(inputPath, outDir, sourceStat, options) {
  const mode = options.mode;
  const markdownPath = path.join(outDir, "document.md");
  if (mode === "never") {
    return {
      markdownPath: "",
      markdownStatus: "disabled",
      markdownCommand: "",
      markdownWarnings: [],
    };
  }
  if (!sourceStat?.isFile()) {
    return {
      markdownPath: "",
      markdownStatus: "skipped-non-file-input",
      markdownCommand: "",
      markdownWarnings: ["MarkItDown conversion is skipped for directory inputs."],
    };
  }
  if (IMAGE_EXTENSIONS.has(path.extname(inputPath).toLowerCase())) {
    return {
      markdownPath: "",
      markdownStatus: "skipped-image-input",
      markdownCommand: "",
      markdownWarnings: ["MarkItDown conversion is skipped for image inputs; use imagePath directly for visual tutoring."],
    };
  }

  const attempts = buildMarkitdownAttempts(inputPath, markdownPath, options);
  const extra = markitdownExtraForInput(inputPath);
  const warnings = [];
  if (attempts.length === 0) {
    return {
      markdownPath: "",
      markdownStatus: mode === "always" ? "failed" : "unavailable",
      markdownCommand: "",
      markdownWarnings: [
        `MarkItDown is unavailable. Install it with \`pip install "markitdown[${extra}]"\` or use \`uvx --from markitdown[${extra}] markitdown\`.`,
      ],
    };
  }

  await fs.mkdir(outDir, { recursive: true });
  for (const attempt of attempts) {
    const result = spawnSync(attempt.command, attempt.args, {
      encoding: "utf8",
      env: {
        ...process.env,
        ...(attempt.env || {}),
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        UV_CACHE_DIR: process.env.UV_CACHE_DIR || path.join(outDir, ".uv-cache"),
        UV_PYTHON_INSTALL_DIR: process.env.UV_PYTHON_INSTALL_DIR || path.join(outDir, ".uv-python"),
        UV_TOOL_DIR: process.env.UV_TOOL_DIR || path.join(outDir, ".uv-tools"),
      },
      timeout: markitdownTimeoutMs(),
      maxBuffer: 100 * 1024 * 1024,
    });
    const exists = fsSync.existsSync(markdownPath);
    const size = exists ? fsSync.statSync(markdownPath).size : 0;
    if (result.status === 0 && exists && size > 0) {
      return {
        markdownPath: path.resolve(markdownPath),
        markdownStatus: "ready",
        markdownCommand: attempt.label,
        markdownBytes: size,
        markdownWarnings: warnings,
      };
    }
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    const message = result.error?.message || stderr || stdout || `exit status ${result.status ?? "unknown"}`;
    warnings.push(`MarkItDown attempt failed (${attempt.label}): ${message}`);
  }

  return {
    markdownPath: "",
    markdownStatus: "failed",
    markdownCommand: "",
    markdownWarnings: warnings,
  };
}

async function prepareImages(inputPath, outDir, baseManifest) {
  const sourceStat = await statPath(inputPath);
  const files = [];

  if (sourceStat?.isDirectory()) {
    const entries = await fs.readdir(inputPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(inputPath, entry.name);
      if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  } else if (sourceStat?.isFile() && IMAGE_EXTENSIONS.has(path.extname(inputPath).toLowerCase())) {
    files.push(inputPath);
  }

  files.sort((left, right) => naturalCompare(path.basename(left), path.basename(right)));
  if (files.length === 0) {
    throw new Error(`No supported image files found in ${inputPath}`);
  }

  return {
    ...baseManifest,
    inputType: sourceStat?.isDirectory() ? "image-folder" : "image",
    pageCount: files.length,
    pages: files.map((filePath, index) => ({
      pageNumber: index + 1,
      sourceName: path.basename(filePath),
      imagePath: path.resolve(filePath),
      extractedText: "",
      status: "image-ready",
      warnings: [],
    })),
    outputDir: outDir,
  };
}

async function preparePdf(inputPath, outDir, baseManifest, options) {
  const pagesDir = path.join(outDir, "pages");
  const python = findPython(options.python);
  const popplerPath = findPopplerPath(options.popplerPath);
  const renderMode = options.renderPdf;
  const dpi = options.dpi;
  const script = String.raw`
import json
import os
import sys

pdf_path, pages_dir, render_mode, dpi_raw, poppler_path = sys.argv[1:6]
dpi = int(dpi_raw)
result = {"pageCount": 0, "pages": [], "warnings": [], "popplerPath": poppler_path or ""}

try:
    from pypdf import PdfReader
    reader = PdfReader(pdf_path)
    result["pageCount"] = len(reader.pages)
    for index, page in enumerate(reader.pages):
        warning = None
        try:
            text = page.extract_text() or ""
            status = "text-extracted"
        except Exception as exc:
            text = ""
            status = "text-extract-failed"
            warning = str(exc)
        item = {
            "pageNumber": index + 1,
            "sourceName": os.path.basename(pdf_path),
            "imagePath": "",
            "extractedText": text,
            "status": status,
            "warnings": [],
        }
        if warning:
            item["warnings"].append(warning)
        result["pages"].append(item)
except Exception as exc:
    result["warnings"].append("PDF text extraction failed: " + str(exc))

if render_mode != "never":
    try:
        from pdf2image import convert_from_path
        os.makedirs(pages_dir, exist_ok=True)
        kwargs = {"dpi": dpi}
        if poppler_path:
            kwargs["poppler_path"] = poppler_path
        images = convert_from_path(pdf_path, **kwargs)
        if not result["pages"]:
            result["pageCount"] = len(images)
            result["pages"] = [
                {
                    "pageNumber": index + 1,
                    "sourceName": os.path.basename(pdf_path),
                    "imagePath": "",
                    "extractedText": "",
                    "status": "rendered",
                    "warnings": [],
                }
                for index in range(len(images))
            ]
        for index, image in enumerate(images):
            image_path = os.path.abspath(os.path.join(pages_dir, f"page-{index + 1:03d}.png"))
            image.save(image_path, "PNG")
            if index < len(result["pages"]):
                result["pages"][index]["imagePath"] = image_path
                if result["pages"][index]["status"] == "text-extracted":
                    result["pages"][index]["status"] = "text-and-image-ready"
                elif result["pages"][index]["status"] == "text-extract-failed":
                    result["pages"][index]["status"] = "image-ready"
                else:
                    result["pages"][index]["status"] = "rendered"
    except Exception as exc:
        if poppler_path:
            message = "PDF rendering failed with Poppler path " + poppler_path + ": " + str(exc)
        else:
            message = "PDF rendering failed: " + str(exc)
        result["warnings"].append(message)
        if render_mode == "always":
            result["renderError"] = message

print(json.dumps(result, ensure_ascii=True))
`;

  const extracted = runPythonJson(python, script, [inputPath, pagesDir, renderMode, String(dpi), popplerPath]);
  if (!extracted.ok) {
    return {
      ...baseManifest,
      inputType: "pdf",
      pageCount: 0,
      pages: [],
      outputDir: outDir,
      warnings: [`PDF preparation failed: ${extracted.error}`],
    };
  }

  const manifest = {
    ...baseManifest,
    inputType: "pdf",
    pageCount: extracted.value.pageCount || extracted.value.pages.length,
    pages: extracted.value.pages,
    outputDir: outDir,
    warnings: extracted.value.warnings || [],
    popplerPath: extracted.value.popplerPath || popplerPath || "",
  };
  if (renderMode === "always" && extracted.value.renderError) {
    manifest.status = "render-failed";
  }
  return manifest;
}

async function extractPptxText(inputPath, python) {
  const script = String.raw`
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

pptx_path = sys.argv[1]
result = {"pages": [], "warnings": []}
try:
    with zipfile.ZipFile(pptx_path) as zf:
        names = zf.namelist()
        slide_names = sorted(
            [name for name in names if re.match(r"ppt/slides/slide\d+\.xml$", name)],
            key=lambda name: int(re.search(r"slide(\d+)\.xml$", name).group(1)),
        )
        for index, name in enumerate(slide_names):
            text_parts = []
            try:
                root = ET.fromstring(zf.read(name))
                for node in root.iter():
                    if node.tag.endswith("}t") and node.text:
                        text_parts.append(node.text)
            except Exception as exc:
                result["warnings"].append(f"Slide {index + 1} text extraction failed: {exc}")
            result["pages"].append({
                "pageNumber": index + 1,
                "sourceName": os.path.basename(pptx_path),
                "imagePath": "",
                "extractedText": "\n".join(text_parts).strip(),
                "status": "text-extracted" if text_parts else "no-text-found",
                "warnings": [],
            })
except Exception as exc:
    result["warnings"].append("PPTX text extraction failed: " + str(exc))

print(json.dumps(result, ensure_ascii=True))
`;

  const extracted = runPythonJson(python, script, [inputPath]);
  if (!extracted.ok) {
    return { pages: [], warnings: [`PPTX text extraction failed: ${extracted.error}`] };
  }
  return extracted.value;
}

async function preparePptx(inputPath, outDir, baseManifest, options) {
  const python = findPython(options.python);
  const textResult = await extractPptxText(inputPath, python);
  const pages = textResult.pages || [];
  const warnings = [...(textResult.warnings || [])];
  const slidesDir = path.join(outDir, "slides");
  const scale = options.scale;

  try {
    const { FileBlob, PresentationFile } = await importArtifactTool(options.nodeModules);
    await fs.mkdir(slidesDir, { recursive: true });
    const presentation = await PresentationFile.importPptx(await FileBlob.load(inputPath));
    const slides = slidesFromPresentation(presentation);

    while (pages.length < slides.length) {
      pages.push({
        pageNumber: pages.length + 1,
        sourceName: path.basename(inputPath),
        imagePath: "",
        extractedText: "",
        status: "no-text-found",
        warnings: [],
      });
    }

    for (let index = 0; index < slides.length; index += 1) {
      const slideNumber = index + 1;
      const imagePath = path.join(slidesDir, `slide-${String(slideNumber).padStart(3, "0")}.png`);
      const preview = await presentation.export({ slide: slides[index], format: "png", scale });
      await saveBlobToFile(preview, imagePath);
      pages[index].imagePath = path.resolve(imagePath);
      pages[index].status = pages[index].extractedText ? "text-and-image-ready" : "image-ready";
    }
  } catch (error) {
    warnings.push(
      [
        `PPTX rendering failed: ${error.message}`,
        "If slide visuals, equations, charts, or layout matter, ask the user to export the deck as PDF or provide screenshots for affected slides.",
      ].join(" "),
    );
  }

  return {
    ...baseManifest,
    inputType: "pptx",
    pageCount: pages.length,
    pages,
    outputDir: outDir,
    warnings,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const inputPath = path.resolve(requireArg(args, "input"));
  const outDir = path.resolve(requireArg(args, "out-dir"));
  const batchSize = args["batch-size"] ? Number.parseInt(args["batch-size"], 10) : 1;
  const renderPdf = args["render-pdf"] || "auto";
  const markdownMode = args["markdown-mode"] || "auto";
  const dpi = args.dpi ? Number.parseInt(args.dpi, 10) : 160;
  const scale = args.scale ? Number.parseFloat(args.scale) : 1;

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("--batch-size must be a positive integer");
  }
  if (!["auto", "never", "always"].includes(renderPdf)) {
    throw new Error("--render-pdf must be auto, never, or always");
  }
  if (!["auto", "never", "always"].includes(markdownMode)) {
    throw new Error("--markdown-mode must be auto, never, or always");
  }
  if (!Number.isInteger(dpi) || dpi <= 0) {
    throw new Error("--dpi must be a positive integer");
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("--scale must be a positive number");
  }

  const sourceStat = await statPath(inputPath);
  if (!sourceStat) {
    throw new Error(`Input does not exist: ${inputPath}`);
  }

  await fs.mkdir(outDir, { recursive: true });

  const extension = sourceStat.isFile() ? path.extname(inputPath).toLowerCase() : "";
  const baseManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    inputPath,
    inputName: path.basename(inputPath),
    suggestedBatchSize: batchSize,
    status: "prepared",
    warnings: [],
    pages: [],
  };

  let manifest;
  if (sourceStat.isDirectory() || IMAGE_EXTENSIONS.has(extension)) {
    manifest = await prepareImages(inputPath, outDir, baseManifest);
  } else if (extension === ".pdf") {
    manifest = await preparePdf(inputPath, outDir, baseManifest, {
      python: args.python,
      popplerPath: args["poppler-path"],
      renderPdf,
      dpi,
    });
  } else if (extension === ".pptx") {
    manifest = await preparePptx(inputPath, outDir, baseManifest, {
      python: args.python,
      nodeModules: args["node-modules"],
      scale,
    });
  } else {
    throw new Error(`Unsupported input type: ${extension || "directory without images"}`);
  }

  const markdown = await prepareMarkdown(inputPath, outDir, sourceStat, {
    command: args["markitdown-command"],
    mode: markdownMode,
    python: args.python,
    source: args["markitdown-source"],
  });
  manifest.markdownPath = markdown.markdownPath;
  manifest.markdownStatus = markdown.markdownStatus;
  manifest.markdownCommand = markdown.markdownCommand;
  manifest.markdownBytes = markdown.markdownBytes || 0;
  manifest.markdownWarnings = markdown.markdownWarnings;
  if (markdownMode === "always" && markdown.markdownStatus === "failed") {
    manifest.status = "markdown-failed";
  }

  const manifestPath = path.join(outDir, "manifest.json");
  manifest.manifestPath = path.resolve(manifestPath);
  manifest.nextStep =
    "Teach exactly one page per response by default. If markdownPath is ready, read document.md first for document structure and token-efficient text. Inspect imagePath when present, and use extractedText as support rather than the only source of truth.";
  await writeJson(manifestPath, manifest);

  console.log(JSON.stringify({
    manifestPath: manifest.manifestPath,
    inputType: manifest.inputType,
    pageCount: manifest.pageCount,
    markdownStatus: manifest.markdownStatus,
    markdownPath: manifest.markdownPath || undefined,
    warnings: manifest.warnings,
    markdownWarnings: manifest.markdownWarnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
