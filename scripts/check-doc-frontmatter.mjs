import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const documentationRoot = resolve(repositoryRoot, "docs");
const allowedDocTypes = new Set(["overview", "tutorial", "how-to", "reference", "explanation"]);
const markdownFiles = [];

function collectMarkdownFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".vitepress") continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collectMarkdownFiles(path);
    else if (entry.isFile() && entry.name.endsWith(".md")) markdownFiles.push(path);
  }
}

collectMarkdownFiles(documentationRoot);

const violations = [];
for (const path of markdownFiles) {
  const content = readFileSync(path, "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const displayPath = relative(repositoryRoot, path);

  if (!frontmatter) {
    violations.push(`${displayPath}: missing YAML frontmatter`);
    continue;
  }

  const metadata = new Map();
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/);
    if (field) metadata.set(field[1], field[2]);
  }

  for (const field of ["title", "description", "docType"]) {
    if (!metadata.get(field)) violations.push(`${displayPath}: missing ${field} metadata`);
  }

  const docType = metadata.get("docType");
  if (docType && !allowedDocTypes.has(docType)) {
    violations.push(`${displayPath}: unsupported docType ${docType}`);
  }
}

if (violations.length > 0) {
  process.stderr.write(`Documentation metadata check failed:\n${violations.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Documentation metadata is complete for ${markdownFiles.length} pages.\n`);
}
