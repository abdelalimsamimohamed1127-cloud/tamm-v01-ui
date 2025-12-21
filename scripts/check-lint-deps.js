#!/usr/bin/env node
import { createRequire } from "node:module";
import { stderr } from "node:process";

const require = createRequire(import.meta.url);

const requiredPackages = [
  "eslint",
  "@eslint/js",
  "globals",
  "eslint-plugin-react-hooks",
  "eslint-plugin-react-refresh",
  "typescript-eslint",
];

const missing = requiredPackages.filter((pkg) => {
  try {
    require.resolve(pkg);
    return false;
  } catch {
    return true;
  }
});

if (missing.length > 0) {
  stderr.write(
    `Missing lint dependencies: ${missing.join(
      ", ",
    )}. Install dev dependencies (npm install) before running lint.\n`,
  );
  process.exit(1);
}
