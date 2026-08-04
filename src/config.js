import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 8787,
  nodeEnv: process.env.NODE_ENV || "development",
  demoMode: process.env.DEMO_MODE !== "false",
};
