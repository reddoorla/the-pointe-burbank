// scratchpad/regen-types.mjs — drives Slice Machine manager's updateSlice to
// rewrite src/prismicio-types.d.ts + the slice's mocks.json headlessly.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const [, , repoRoot, libraryID, modelPath] = process.argv;
const pnpmDir = path.join(repoRoot, "node_modules/.pnpm");
const managerPkg = readdirSync(pnpmDir).find((d) =>
  d.startsWith("@slicemachine+manager@"),
);
const entry = path.join(
  pnpmDir,
  managerPkg,
  "node_modules/@slicemachine/manager/dist/index.cjs",
);
const { createSliceMachineManager } = require(entry);
const model = JSON.parse(readFileSync(modelPath, "utf8"));
const manager = createSliceMachineManager();
await manager.plugins.initPlugins();
await manager.slices.updateSlice({ libraryID, model });
