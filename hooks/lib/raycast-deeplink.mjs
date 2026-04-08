import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function triggerRaycast(event, extension = "fulln/claude-raycast-notifier", command = "notify-event") {
  const payload = Buffer.from(JSON.stringify(event), "utf8").toString("base64");
  const args = encodeURIComponent(JSON.stringify({ payload }));
  const url = `raycast://extensions/${extension}/${command}?arguments=${args}`;
  await execFileAsync("open", [url]);
}
