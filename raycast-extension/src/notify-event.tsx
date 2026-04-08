import { LaunchProps, showToast, Toast } from "@raycast/api";
import { decodePayload } from "./lib/event";

type Arguments = { payload: string };

export default async function Command(
  props: LaunchProps<{ arguments: Arguments }>,
) {
  const event = decodePayload(props.arguments.payload);

  await showToast({
    style: styleFor(event.severity),
    title: event.title,
    message: event.message,
  });
}

function styleFor(severity: "info" | "warning" | "error") {
  if (severity === "error") return Toast.Style.Failure;
  if (severity === "warning") return Toast.Style.Animated;
  return Toast.Style.Success;
}
