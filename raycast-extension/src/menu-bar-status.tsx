import {
  Icon,
  MenuBarExtra,
  openCommandPreferences,
  usePromise,
} from "@raycast/api";
import { loadState } from "./lib/state";

export default function Command() {
  const { data, isLoading } = usePromise(loadState, []);
  const current = data?.current;

  return (
    <MenuBarExtra
      icon={iconFor(current?.severity)}
      title={titleFor(current, isLoading)}
    >
      <MenuBarExtra.Section title="Current Status">
        <MenuBarExtra.Item
          title={current?.title ?? "Claude idle"}
          subtitle={current?.message ?? "No events yet"}
        />
      </MenuBarExtra.Section>
      <MenuBarExtra.Section title="Recent Events">
        {(data?.recent ?? []).slice(0, 5).map((event) => (
          <MenuBarExtra.Item
            key={`${event.timestamp}-${event.type}`}
            title={event.title}
            subtitle={event.message}
          />
        ))}
      </MenuBarExtra.Section>
      <MenuBarExtra.Item
        title="Open Preferences"
        onAction={openCommandPreferences}
      />
    </MenuBarExtra>
  );
}

function titleFor(
  current: { type: string } | null | undefined,
  isLoading: boolean,
) {
  if (isLoading) return "Claude…";
  if (!current) return "Claude Idle";
  if (current.type === "needs_input") return "Claude Waiting";
  if (current.type === "failure") return "Claude Error";
  if (current.type === "done") return "Claude Done";
  return "Claude Working";
}

function iconFor(severity: string | undefined) {
  if (severity === "error") return Icon.XMarkCircle;
  if (severity === "warning") return Icon.ExclamationMark;
  return Icon.Terminal;
}
