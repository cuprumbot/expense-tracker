import { stopDevServer } from "./server-manager";

export default async function globalTeardown() {
  await stopDevServer();
}
