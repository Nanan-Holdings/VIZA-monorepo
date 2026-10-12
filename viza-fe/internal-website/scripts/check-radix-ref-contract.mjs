import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(projectRoot, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const lockPackages = lock.packages ?? {};

const contracts = [
  { name: "@radix-ui/react-slot", minimum: "1.3.3" },
  { name: "@radix-ui/react-focus-scope", minimum: "1.1.16" },
  { name: "@radix-ui/react-dismissable-layer", minimum: "1.1.19" },
  { name: "@radix-ui/react-popper", minimum: "1.3.7" },
  { name: "@radix-ui/react-scroll-area", minimum: "1.2.18" },
  { name: "@radix-ui/react-toast", minimum: "1.2.23" },
];

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(version));
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] !== undefined,
  };
}

function compareVersions(left, right) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) return null;

  for (const part of ["major", "minor", "patch"]) {
    if (leftVersion[part] !== rightVersion[part]) {
      return leftVersion[part] > rightVersion[part] ? 1 : -1;
    }
  }

  if (leftVersion.prerelease !== rightVersion.prerelease) {
    return leftVersion.prerelease ? -1 : 1;
  }
  return 0;
}

function packageKey(name) {
  return `node_modules/${name}`;
}

function packageEntries(name) {
  const key = packageKey(name);
  return Object.entries(lockPackages).filter(
    ([packagePath]) => packagePath === key || packagePath.endsWith(`/${key}`),
  );
}

function declaredDependency(metadata, name) {
  return metadata?.dependencies?.[name] ?? metadata?.optionalDependencies?.[name];
}

function consumerPaths(name) {
  const consumers = new Set();
  for (const [packagePath, metadata] of Object.entries(lockPackages)) {
    if (declaredDependency(metadata, name)) consumers.add(packagePath);
  }
  return [...consumers];
}

function findLockedResolution(consumer, name) {
  let directory = consumer;
  const key = packageKey(name);

  while (true) {
    const candidate = directory ? `${directory}/${key}` : key;
    if (lockPackages[candidate]) return candidate;

    const parent = directory ? path.posix.dirname(directory) : ".";
    if (!directory || parent === directory) return null;
    directory = parent === "." ? "" : parent;
  }
}

function readInstalledPackage(consumer, name) {
  const consumerPackageJson = path.join(projectRoot, consumer, "package.json");
  let entry;
  try {
    entry = createRequire(consumerPackageJson).resolve(name);
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    throw new Error(
      `Radix ref contract failed for ${consumer || "the application"}: cannot resolve ${name}${detail}. Run npm ci.`,
    );
  }

  const packageDirectory = path.resolve(path.dirname(entry), "..");
  const packageJsonPath = path.join(packageDirectory, "package.json");
  let installed;
  try {
    installed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    throw new Error(
      `Radix ref contract failed for ${consumer || "the application"}: cannot read ${name} package metadata${detail}. Run npm ci.`,
    );
  }
  if (installed.name !== name) {
    throw new Error(
      `Radix ref contract failed for ${consumer || "the application"}: resolved package metadata is ${installed.name ?? "unnamed"}, expected ${name}. Run npm ci.`,
    );
  }

  const relativePath = path.relative(projectRoot, packageDirectory).split(path.sep).join("/");
  const lockedPath = findLockedResolution(consumer, name);
  const lockEntry = lockedPath ? lockPackages[lockedPath] : undefined;
  if (!lockEntry) {
    throw new Error(
      `Radix ref contract failed for ${consumer || "the application"}: installed ${name}@${installed.version} is missing from package-lock.json. Run npm ci.`,
    );
  }
  if (relativePath !== lockedPath || installed.version !== lockEntry.version) {
    throw new Error(
      `Radix ref contract failed for ${consumer || "the application"}: installed ${name}@${installed.version} resolves at ${relativePath}, but package-lock.json selects ${lockedPath}@${lockEntry.version}. Run npm ci.`,
    );
  }

  return installed;
}

let checkedConsumers = 0;
for (const contract of contracts) {
  const entries = packageEntries(contract.name);
  if (entries.length === 0) {
    throw new Error(
      `Radix ref contract failed: package-lock.json has no ${packageKey(contract.name)} entry (including nested copies). Run npm ci.`,
    );
  }

  for (const [packagePath, metadata] of entries) {
    const comparison = compareVersions(metadata.version, contract.minimum);
    if (comparison === null || comparison < 0) {
      throw new Error(
        `Radix ref contract failed: ${packagePath} is ${metadata.version}; ${contract.name} requires ${contract.minimum} or newer for React 19 stable refs. Run npm ci.`,
      );
    }
  }

  for (const consumer of consumerPaths(contract.name)) {
    const installed = readInstalledPackage(consumer, contract.name);
    const comparison = compareVersions(installed.version, contract.minimum);
    if (comparison === null || comparison < 0) {
      throw new Error(
        `Radix ref contract failed for ${consumer || "the application"}: resolved ${contract.name}@${installed.version}; requires ${contract.minimum} or newer for React 19 stable refs. Run npm ci.`,
      );
    }
    checkedConsumers += 1;
  }
}

console.log(
  `Radix ref contract OK: ${contracts.length} primitives and ${checkedConsumers} dependency consumers meet stable-ref minima.`,
);
