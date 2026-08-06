import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

export const config = {
  port: Number(process.env.PORT) || 8787,
  nodeEnv: process.env.NODE_ENV || "development",
  get demoMode() {
    return process.env.DEMO_MODE !== "false";
  },
};
