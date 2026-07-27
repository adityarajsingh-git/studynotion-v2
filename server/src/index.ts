import { env } from "./config/env";
import { connectDB } from "./config/db";
import { createApp } from "./app";

async function main() {
  await connectDB();
  createApp().listen(env.port, () =>
    console.log(`🚀 StudyNotion v2 API on http://localhost:${env.port}`)
  );
}
main();
