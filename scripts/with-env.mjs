import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

console.log(`[with-env] PORT=${process.env.PORT ?? "(default 3000)"}`);

const [, , binPath, ...cliArgs] = process.argv;
const resolvedBinPath = path.resolve(process.cwd(), binPath);
process.argv = [process.argv[0], resolvedBinPath, ...cliArgs];
await import(pathToFileURL(resolvedBinPath).href);
