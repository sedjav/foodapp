import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
let dir = here;

for (let i = 0; i < 6; i++) {
  const candidate = path.join(dir, ".env");
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}
