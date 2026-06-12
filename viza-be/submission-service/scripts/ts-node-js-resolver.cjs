const fs = require("fs");
const path = require("path");
const Module = require("module");

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveTsSourceForJsSpecifier(request, parent, isMain, options) {
  if (
    parent &&
    request.startsWith(".") &&
    request.endsWith(".js") &&
    !parent.filename.includes(`${path.sep}dist${path.sep}`)
  ) {
    const parentDir = path.dirname(parent.filename);
    const absoluteRequest = path.resolve(parentDir, request);
    const tsCandidate = absoluteRequest.slice(0, -3) + ".ts";
    const indexTsCandidate = path.join(absoluteRequest.slice(0, -3), "index.ts");

    if (fs.existsSync(tsCandidate)) {
      return tsCandidate;
    }

    if (fs.existsSync(indexTsCandidate)) {
      return indexTsCandidate;
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
