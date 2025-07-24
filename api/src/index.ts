import HyperExpress from "hyper-express";
import LiveDirectory from "live-directory";
import { colors, logger, logRequest } from "./utils/logger";
import { requireAuth, setupAuthEndpoints } from "./routes/auth";
import { setupUserEndpoints } from "./routes/user";
import { setupSavedsEndpoints } from "./routes/saveds";
import { setupRecordsEndpoints } from "./routes/records";
import { setupAdminRoutes } from "./routes/admin";

const server = new HyperExpress.Server();

// Middleware
server.use(logRequest);
server.use("/api", (request, response, next) => {
  if (
    request.path == "/api/auth/login" ||
    request.path == "/api/auth/refresh"
  ) {
    return next();
  }

  return requireAuth(request, response, next);
});

const BYPASS_IS_ADMIN_CHECK =
  process.env.BYPASS_IS_ADMIN_CHECK === "true" ? true : false;
server.use("/api/admin", (request, response, next) => {
  const payload = request.payload;
  if (!payload || (!payload.isAdmin && !BYPASS_IS_ADMIN_CHECK)) {
    return response.status(403).json({ error: "Forbidden" });
  }

  next();
});

// Serve static files from the "static" directory
const staticAssets = new LiveDirectory("./static", {
  filter: {
    keep: {
      extensions: ["css", "js", "html"],
    },
    ignore: (path) => {
      return path.startsWith(".");
    },
  },
  cache: {
    max_file_count: 250,
    max_file_size: 1024 * 1024,
  },
});

server.get("/static/*", (request, response) => {
  const path = request.path.replace("/static", "");
  const file = staticAssets.get(path);

  if (file === undefined) return response.status(404).send();

  const fileParts = file.path.split(".");
  const extension = fileParts[fileParts.length - 1];

  const content = file.content;
  return response.status(200).type(extension).send(content);
});

server.get("/", (_, response) => {
  const file = staticAssets.get("index.html");
  if (file === undefined) return response.status(404).send();

  const content = file.content;
  return response.status(200).type("html").send(content);
});

// Api endpoint
setupAuthEndpoints(server);
setupUserEndpoints(server);
setupSavedsEndpoints(server);
setupRecordsEndpoints(server);
setupAdminRoutes(server);

// Start the server on the specified port
const PORT: number = Number(process.env.PORT) || 3000;
server
  .listen(PORT)
  .then(() =>
    logger.info(
      `${colors.cyan}Server is running on ${colors.magenta}${PORT}${colors.reset}`
    )
  )
  .catch((error) =>
    logger.error(
      { error: error.message },
      `${colors.red}Failed to start server on port ${PORT}${colors.reset}`
    )
  );
