import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignoredDirectories = new Set([".git", ".next", ".turbo", "build", "coverage", "dist", "node_modules", "target"]);
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);
const sourceFiles = [];

function collectSourceFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) collectSourceFiles(path);
    } else if (entry.isFile() && sourceExtensions.has(path.slice(path.lastIndexOf(".")))) {
      sourceFiles.push(path);
    }
  }
}

for (const sourceDirectory of ["apps", "packages", "contracts", "scripts", "docs/.vitepress"]) {
  collectSourceFiles(resolve(repositoryRoot, sourceDirectory));
}

for (const entry of readdirSync(repositoryRoot, { withFileTypes: true })) {
  if (entry.isFile() && sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
    sourceFiles.push(resolve(repositoryRoot, entry.name));
  }
}

const violations = [];
for (const path of sourceFiles) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  function inspect(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const position = source.getLineAndCharacterOfPosition(node.getStart(source));
      violations.push(`${relative(repositoryRoot, path)}:${position.line + 1}: explicit any type`);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}

if (violations.length > 0) {
  process.stderr.write(`Found ${violations.length} explicit any type${violations.length === 1 ? "" : "s"}:\n`);
  process.stderr.write(`${violations.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`No explicit any types found in ${sourceFiles.length} TypeScript files.\n`);
}
