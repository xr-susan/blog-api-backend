import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const server = createApp(config);

server.listen(config.port, () => {
  console.log(`Blog API listening on http://localhost:${config.port}`);
});
