import { spawnSync } from "node:child_process";
import process from "node:process";

const collections = [
  "qh_accounts",
  "qh_sessions",
  "qh_states",
  "qh_rate_limits",
  "qh_ai_daily",
];

function commandFor(type) {
  return JSON.stringify(collections.map((name) => ({
    TableName: name,
    CommandType: type,
    Command: JSON.stringify(type === "INSERT"
      ? { insert: name, documents: [{ _id: "__bootstrap__", kind: "bootstrap" }] }
      : { delete: name, deletes: [{ q: { _id: "__bootstrap__" }, limit: 1 }] }),
  })));
}

function run(command) {
  return spawnSync(process.execPath, [
    "node_modules/@cloudbase/cli/bin/tcb",
    "db",
    "nosql",
    "execute",
    "--command",
    command,
    "--json",
  ], { stdio: "inherit", shell: false });
}

if (!process.argv.includes("--cleanup-only")) {
  const inserted = run(commandFor("INSERT"));
  if (inserted.status !== 0) process.exit(inserted.status ?? 1);
}
const cleaned = run(commandFor("DELETE"));
process.exit(cleaned.status ?? 1);
