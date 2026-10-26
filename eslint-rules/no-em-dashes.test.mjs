// @vitest-environment node
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({
  cwd: fileURLToPath(new URL("../", import.meta.url)),
});
const emDash = "\u2014";

test.each([
  [
    "probe.ts",
    `// ${emDash}\n/* ${emDash} */\nexport const message: string = "${emDash}${emDash}";`,
  ],
  [
    "probe.tsx",
    `export function Probe() { return <p title="${emDash}">${emDash}{/* ${emDash} */}</p>; }`,
  ],
  [
    "probe.mjs",
    `export const pattern = /${emDash}/; // ${emDash}\r\nexport const template = \`${emDash}\`;`,
  ],
  [
    "docs/probe.md",
    `---\ntitle: Probe ${emDash}\n---\nText ${emDash}.\n\n\`\`\`ts\n// ${emDash}\n\`\`\`\n<!-- ${emDash} -->\n`,
  ],
  [
    "docs/probe.mdx",
    `import Example from './Example';\n\n<Example title="${emDash}" />\n\nText ${emDash} more ${emDash} text.\n`,
  ],
])(
  "reports every em dash with its exact location in %s",
  async (filePath, code) => {
    const [result] = await eslint.lintText(code, { filePath });
    const expected = [...code.matchAll(/\u2014/gu)].map((match) => {
      const lines = code.slice(0, match.index).split(/\r?\n/u);
      const column = lines.at(-1).length + 1;
      return {
        ruleId: "fikra/no-em-dashes",
        messageId: "forbidden",
        severity: 2,
        line: lines.length,
        column,
        endLine: lines.length,
        endColumn: column + 1,
      };
    });

    expect(result.fatalErrorCount).toBe(0);
    expect(result.errorCount).toBe(expected.length);
    expect(result.messages).toMatchObject(expected);
  },
);

test.each([
  "probe.ts",
  "probe.tsx",
  "probe.mjs",
  "docs/probe.md",
  "docs/probe.mdx",
])("allows hyphens, en dashes, and escaped Unicode in %s", async (filePath) => {
  const [result] = await eslint.lintText(
    '// ordinary - and en dash \u2013\nexport const escaped = "\\u2014";',
    { filePath },
  );
  expect(result.messages).toEqual([]);
});

test.each([
  "convex/_generated/probe.ts",
  "convex/_generated/ai/probe.md",
  ".next/probe.ts",
  "node_modules/probe.ts",
  ".convex/probe.ts",
])("preserves the generated-file exclusion for %s", async (filePath) => {
  expect(await eslint.isPathIgnored(filePath)).toBe(true);
});

test.each([
  [
    "probe.ts",
    "export const value: any = 1;",
    "@typescript-eslint/no-explicit-any",
  ],
  [
    "probe.tsx",
    "export function Probe() { return [<p />]; }",
    "@eslint-react/no-missing-key",
  ],
  [
    "probe.tsx",
    "export function Probe() { return <head />; }",
    "@next/next/no-head-element",
  ],
])("preserves existing lint rule %s: %s", async (filePath, code, ruleId) => {
  const [result] = await eslint.lintText(code, { filePath });
  expect(result.fatalErrorCount).toBe(0);
  expect(result.messages.some((message) => message.ruleId === ruleId)).toBe(
    true,
  );
});
