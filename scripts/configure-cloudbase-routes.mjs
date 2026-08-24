import { spawnSync } from "node:child_process";
import process from "node:process";

function run(args) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/@cloudbase/cli/bin/tcb", ...args, "--json"],
    { input: "y\n", stdio: ["pipe", "inherit", "inherit"], shell: false },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([
  "routes",
  "edit",
  "--data",
  JSON.stringify({
    domain: "*",
    routes: [
      {
        path: "/api",
        upstreamResourceType: "SCF",
        upstreamResourceName: "qingheng-api",
        enable: true,
        enableAuth: false,
        enableSafeDomain: true,
        enablePathTransmission: true,
        qpsPolicy: {
          qpsTotal: 200,
          qpsPerClient: { limitBy: "ClientIP", limitValue: 30 },
        },
      },
    ],
  }),
]);

if (process.argv.includes("--with-static")) {
  run([
    "routes",
    "add",
    "--data",
    JSON.stringify({
      domain: "*",
      routes: [
        {
          path: "/",
          upstreamResourceType: "STATIC_STORE",
          upstreamResourceName: "staticstore",
          enable: true,
          enableAuth: false,
          enableSafeDomain: true,
          enablePathTransmission: true,
        },
      ],
    }),
  ]);
}

if (process.argv.includes("--clean-root")) {
  run([
    "routes",
    "edit",
    "--data",
    JSON.stringify({
      domain: "*",
      routes: [
        {
          path: "/",
          upstreamResourceType: "STATIC_STORE",
          upstreamResourceName: "staticstore",
          enablePathTransmission: true,
        },
      ],
    }),
  ]);
}
