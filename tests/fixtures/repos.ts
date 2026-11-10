
export const nodeAppFiles: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "widget-service",
      description: "A small Express widget API",
      packageManager: "pnpm@10.0.0",
      scripts: {
        dev: "tsx watch src/index.ts",
        build: "tsc -p tsconfig.json",
        test: "vitest run",
        lint: "eslint .",
        seed: "tsx scripts/seed.ts",
      },
      dependencies: { express: "^5.1.0" },
      devDependencies: { typescript: "^5.7.0", vitest: "^3.0.0", vite: "^6.0.0" },
    },
    null,
    2,
  ),
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  "README.md": "# Widget Service\n\nOld documentation that no longer matches the code.\n",
  "LICENSE": "MIT License\n\nCopyright (c) 2026 Example\n",
  ".env.example": "PORT=3000\nDATABASE_URL=postgres://user:pass@localhost:5432/widget\nFEATURE_FLAGS=\n",
  ".gitignore": "dist/\nnode_modules/\ncoverage/\n",
  "Dockerfile": "FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nCMD [\"node\", \"dist/index.js\"]\n",
  ".github/workflows/ci.yml": "name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: pnpm test\n",
  "src/index.ts": `import express from "express";
import { usersRouter } from "./users.js";

const app = express();
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/users", usersRouter);
app.listen(3000);
`,
  "src/users.ts": `import { Router } from "express";
export const usersRouter = Router();
usersRouter.get("/users", (_req, res) => res.json([]));
usersRouter.post("/users", (_req, res) => res.status(201).json({}));
`,
  "src/users.test.ts": `import { describe, it, expect } from "vitest";\ndescribe("users", () => { it("works", () => expect(true).toBe(true)); });\n`,
};

export const pythonAppFiles: Record<string, string> = {
  "requirements.txt": "fastapi==0.115.0\nuvicorn==0.32.0\npytest==8.3.0\n",
  "app/main.py": `from fastapi import FastAPI

app = FastAPI()

@app.get("/items")
def list_items():
    return []

@app.post("/items")
def create_item():
    return {"ok": True}
`,
  ".env.sample": "DATABASE_URL=sqlite:///./app.db\nLOG_LEVEL=info\n",
  "tests/test_items.py": "def test_list():\n    assert True\n",
};

export const monorepoFiles: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "acme-platform",
      private: true,
      scripts: { build: "pnpm -r build", test: "pnpm -r test" },
      devDependencies: { typescript: "^5.7.0" },
    },
    null,
    2,
  ),
  "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
  "turbo.json": JSON.stringify({ pipeline: { build: { dependsOn: ["^build"] } } }),
  "packages/api/package.json": JSON.stringify(
    { name: "@acme/api", scripts: { build: "tsc", test: "vitest run" }, dependencies: { express: "^5.0.0" } },
    null,
    2,
  ),
  "packages/web/package.json": JSON.stringify(
    { name: "@acme/web", scripts: { build: "vite build" }, dependencies: { react: "^19.0.0" } },
    null,
    2,
  ),
  "packages/api/src/index.ts": 'console.log("api");\n',
  "packages/web/src/main.tsx": 'console.log("web");\n',
};

export const emptyRepoFiles: Record<string, string> = {
  "notes.txt": "scratch notes only\n",
};

export const secretHeavyFiles: Record<string, string> = {
  "package.json": JSON.stringify({ name: "secretive", scripts: { test: "vitest run" } }),
  ".env": "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789\n",
  ".env.example": "GITHUB_TOKEN=\n",
  "id_rsa": "-----BEGIN OPENSSH PRIVATE KEY-----\nsecret\n-----END OPENSSH PRIVATE KEY-----\n",
  "secrets.yml": "password: hunter2\n",
  "node_modules/pkg/index.js": "module.exports = {};\n",
  "dist/bundle.js": "console.log('built');\n",
  "src/app.ts": "export const app = 1;\n",
  "assets/logo.png": "\u0000\u0001binary",
};

export function makeManyFiles(count: number): Record<string, string> {
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "large-repo", scripts: { test: "vitest run" } }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  };
  for (let index = 0; index < count; index += 1) {
    files[`src/module-${index}/index.ts`] = `export const value${index} = ${index};\n`;
  }
  return files;
}

export const noReadmeFiles: Record<string, string> = {
  "package.json": JSON.stringify({ name: "no-readme", scripts: { build: "tsc" } }),
  "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
  "src/index.ts": "export {};\n",
};
