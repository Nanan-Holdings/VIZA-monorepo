import "dotenv/config";
import { startHealthServer } from "../src/health-server.js";

process.env.KR_VISA_PORTAL_EFORM_LOCAL_ENABLED ??= "true";
process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED ??= "true";
process.env.KR_VISA_PORTAL_EFORM_SECOND_PAGE_ENABLED ??= "true";

const port = Number(process.env.PORT || 8081);

startHealthServer({
  isWorkerStarted: () => true,
  port,
});

setInterval(() => undefined, 60_000);
