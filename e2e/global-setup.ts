import { ensureServerStarted } from "./server-manager";

export default async function globalSetup() {
  await ensureServerStarted();
}
