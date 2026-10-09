import { createApp } from "./app";
import { connectDatabase } from "./config/database";
import { config } from "./config";

async function start(): Promise<void> {
  try {
    await connectDatabase();

    const app = createApp();
    app.listen(config.port, () => {
      console.info(
        `[Server] TaskFlow API running on port ${config.port} (${config.nodeEnv})`
      );
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
}

void start();
