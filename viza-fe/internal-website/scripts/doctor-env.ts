import path from "node:path";
import { main } from "../../../scripts/doctor-env";

main({
  rootDir: path.resolve(process.cwd(), "..", ".."),
  fixBom: process.argv.includes("--fix-bom"),
});
