import {
  Action,
  ActionPanel,
  Clipboard,
  Icon,
  MenuBarExtra,
  openCommandPreferences,
  openExtensionPreferences,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { loadState } from "./lib/state";
import { loadInstallStatus } from "./lib/sound-store";

export default function Command() {
  const { data, isLoading } = usePromise(async () => {
    const [state, install] = await Promise.all([
      loadState(),
      loadInstallStatus(),
    ]);
    return { state, install };
  }, []);
  const current = data?.state.current;

  return (
    <MenuBarExtra
      icon={iconFor(
        current?.severity,
        Boolean(current?.action),
        data?.install.healthy ?? true,
      )}
      title={titleFor(current, isLoading)}
    >
      {current?.action ? (
        <MenuBarExtra.Section title="Action Required">
          <MenuBarExtra.Item
            title={current.title}
            subtitle={current.message}
            actions={
              <ActionPanel>
                {current.action.options?.map((option) => (
                  <Action
                    key={option.id}
                    title={`Copy ${option.label}`}
                    onAction={() => Clipboard.copy(option.label)}
                  />
                ))}
                <Action.Open title="Open Claude" target="claude://" />
              </ActionPanel>
            }
          />
          {(current.action.options ?? []).slice(0, 4).map((option) => (
            <MenuBarExtra.Item
              key={option.id}
              title={option.label}
              subtitle={option.detail}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    title="Copy Choice"
                    content={option.label}
                  />
                  <Action.Open title="Open Claude" target="claude://" />
                </ActionPanel>
              }
            />
          ))}
        </MenuBarExtra.Section>
      ) : null}
      <MenuBarExtra.Section title="Sound Setup">
        <MenuBarExtra.Item
          title={
            data?.install.healthy
              ? "Sound setup ready"
              : "Sound setup needs repair"
          }
          subtitle={soundSetupSubtitle(
            data?.install.missing ?? [],
            data?.state.sound,
          )}
        />
      </MenuBarExtra.Section>
      <MenuBarExtra.Section title="Current Status">
        <MenuBarExtra.Item
          title={current?.title ?? "Claude idle"}
          subtitle={current?.message ?? "No events yet"}
        />
      </MenuBarExtra.Section>
      <MenuBarExtra.Section title="Recent Events">
        {(data?.state.recent ?? []).slice(0, 5).map((event) => (
          <MenuBarExtra.Item
            key={`${event.timestamp}-${event.type}`}
            title={event.title}
            subtitle={`${event.soundSlot} • ${event.message}`}
          />
        ))}
      </MenuBarExtra.Section>
      <MenuBarExtra.Item
        title="Extension Preferences"
        onAction={openExtensionPreferences}
      />
      <MenuBarExtra.Item
        title="Command Preferences"
        onAction={openCommandPreferences}
      />
    </MenuBarExtra>
  );
}

function titleFor(
  current: { type: string; action?: unknown } | null | undefined,
  isLoading: boolean,
) {
  if (isLoading) return "Claude…";
  if (!current) return "Claude Idle";
  if (current.action) return "Action Required";
  if (current.type === "needs_input") return "Claude Waiting";
  if (current.type === "failure") return "Claude Error";
  if (current.type === "done") return "Claude Done";
  return "Claude Working";
}

function iconFor(
  severity: string | undefined,
  actionable: boolean,
  healthy: boolean,
) {
  if (!healthy) return Icon.ExclamationMark;
  if (actionable) return Icon.Bell;
  if (severity === "error") return Icon.XMarkCircle;
  if (severity === "warning") return Icon.ExclamationMark;
  return Icon.Terminal;
}

function soundSetupSubtitle(
  missing: string[],
  sound:
    | {
        lastPlayedAt: string | null;
        lastPlayedSoundId: string | null;
        lastSlot: string | null;
        lastError: string | null;
      }
    | undefined,
) {
  if (missing.length > 0) return missing.join(" • ");
  if (!sound?.lastPlayedSoundId) return "No sound played yet";

  const details = [sound.lastPlayedSoundId];
  if (sound.lastSlot) details.push(sound.lastSlot);
  if (sound.lastError) details.push(sound.lastError);
  return details.join(" • ");
}
