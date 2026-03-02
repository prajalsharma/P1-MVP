/**
 * Copy linter for Arkova.
 * Fails CI if any disallowed term is found in source files.
 *
 * Disallowed terms: Wallet, Gas, Transaction
 * These terms imply crypto/blockchain semantics that are not part of Arkova's vocabulary.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const DISALLOWED_TERMS: readonly string[] = ["Wallet", "Gas", "Transaction", "Crypto"];

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".mdx"]);

const IGNORE_PATHS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  // This file itself is allowed to mention the terms
  "scripts/check-copy-terms.ts",
  // fileHasher uses "Web Crypto API" — a standard browser API name, not UI copy
  "src/lib/fileHasher.ts",
]);

interface Violation {
  file: string;
  line: number;
  col: number;
  term: string;
  text: string;
}

function shouldIgnore(filePath: string, root: string): boolean {
  const rel = filePath.replace(root + "/", "");
  for (const ignored of IGNORE_PATHS) {
    if (rel.startsWith(ignored)) return true;
  }
  return false;
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return violations;
  }

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const term of DISALLOWED_TERMS) {
      // Case-sensitive word-boundary check
      const regex = new RegExp(`\\b${term}\\b`);
      const match = regex.exec(line);
      if (match) {
        violations.push({
          file: filePath,
          line: i + 1,
          col: match.index + 1,
          term,
          text: line.trim(),
        });
      }
    }
  }
  return violations;
}

function walkDir(dir: string, root: string): string[] {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir, { withFileTypes: false }) as string[];
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, String(entry));
    if (shouldIgnore(fullPath, root)) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath, root));
    } else if (SCAN_EXTENSIONS.has(extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

function main(): void {
  const root = process.cwd();
  const files = walkDir(root, root);

  const allViolations: Violation[] = [];
  for (const file of files) {
    allViolations.push(...scanFile(file));
  }

  if (allViolations.length === 0) {
    console.log("✓ lint:copy — no disallowed terms found.");
    process.exit(0);
  }

  console.error(`\n✗ lint:copy — ${allViolations.length} violation(s) found:\n`);
  for (const v of allViolations) {
    const rel = v.file.replace(root + "/", "");
    console.error(`  ${rel}:${v.line}:${v.col}  Disallowed term "${v.term}"`);
    console.error(`    > ${v.text}`);
  }
  console.error(
    `\nDisallowed terms: ${DISALLOWED_TERMS.join(", ")}\n` +
      `These imply crypto/blockchain semantics. Use Arkova-approved vocabulary.\n`
  );
  process.exit(1);
}

main();
