export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { startBrandNewsScheduler } = await import("./lib/scheduler");
  startBrandNewsScheduler();
}
