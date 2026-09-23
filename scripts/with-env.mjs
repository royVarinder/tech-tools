import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const [, , binPath, ...cliArgs] = process.argv;
const resolvedBinPath = path.resolve(process.cwd(), binPath);
process.argv = [process.argv[0], resolvedBinPath, ...cliArgs];
await import(pathToFileURL(resolvedBinPath).href);
