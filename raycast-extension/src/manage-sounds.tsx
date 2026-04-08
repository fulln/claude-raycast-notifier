import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  Toast,
  showToast,
  usePromise,
} from "@raycast/api";
import type { SoundSlot } from "./lib/event";
import {
  loadInstallStatus,
  loadSoundLibrary,
  loadSoundMappings,
  previewSoundFile,
  repairUserData,
  resolveManagedSoundPath,
  saveSoundMappings,
} from "./lib/sound-store";
import { SoundLibraryView } from "./sound-library";

const SLOT_ORDER: SoundSlot[] = [
  "needs_input",
  "failure",
  "done",
  "success",
  "running",
];

export default function Command() {
  const { data, isLoading, revalidate } = usePromise(loadManageSoundsData, []);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Manage Claude sound slots"
    >
      <List.Section title="Install Health">
        <List.Item
          icon={{
            source: data?.status.healthy ? Icon.CheckCircle : Icon.Warning,
            tintColor: data?.status.healthy ? Color.Green : Color.Orange,
          }}
          title={
            data?.status.healthy
              ? "Managed sound data is healthy"
              : "Managed sound data needs repair"
          }
          subtitle={installHealthSubtitle(data?.status.missing ?? [])}
          actions={
            <ActionPanel>
              <Action
                title="Repair Managed Sound Data"
                icon={Icon.Wrench}
                onAction={async () => {
                  await showToast({
                    style: Toast.Style.Animated,
                    title: "Repairing managed sound data",
                  });
                  const repaired = await repairUserData();
                  await revalidate();
                  await showToast({
                    style: repaired.status.healthy
                      ? Toast.Style.Success
                      : Toast.Style.Failure,
                    title: repaired.status.healthy
                      ? "Managed sound data repaired"
                      : "Managed sound data still needs attention",
                    message: repaired.status.healthy
                      ? undefined
                      : installHealthSubtitle(repaired.status.missing),
                  });
                }}
              />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Sound Slots">
        {SLOT_ORDER.map((slot) => {
          const mapping = data?.mappings.slots[slot];
          const sound = data?.libraryById.get(mapping?.soundId ?? "");

          return (
            <List.Item
              key={slot}
              icon={iconForSlot(slot, Boolean(mapping?.enabled))}
              title={slotTitle(slot)}
              subtitle={slotSubtitle(mapping?.enabled ?? false, sound?.label)}
              accessories={slotAccessories(
                mapping?.enabled ?? false,
                sound?.label,
              )}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Choose Sound"
                    icon={Icon.Music}
                    target={
                      <SoundLibraryView
                        slot={slot}
                        onAssigned={async () => {
                          await revalidate();
                        }}
                      />
                    }
                  />
                  {sound ? (
                    <Action
                      title="Preview Current Sound"
                      icon={Icon.Play}
                      onAction={() =>
                        previewSoundFile(
                          resolveManagedSoundPath(sound.filename),
                        )
                      }
                    />
                  ) : null}
                  <Action
                    title={
                      mapping?.enabled
                        ? "Mute Slot"
                        : sound
                          ? "Enable Slot"
                          : "Choose Sound to Enable"
                    }
                    icon={
                      mapping?.enabled
                        ? Icon.SpeakerOff
                        : sound
                          ? Icon.SpeakerOn
                          : Icon.Music
                    }
                    onAction={async () => {
                      if (!data) return;

                      if (!mapping?.enabled && !sound) {
                        await showToast({
                          style: Toast.Style.Failure,
                          title: "Choose a sound before enabling this slot",
                        });
                        return;
                      }

                      const updatedMappings = await saveSoundMappings({
                        ...data.mappings,
                        slots: {
                          ...data.mappings.slots,
                          [slot]: {
                            ...data.mappings.slots[slot],
                            enabled: !data.mappings.slots[slot].enabled,
                          },
                        },
                      });

                      await revalidate();
                      await showToast({
                        style: Toast.Style.Success,
                        title: updatedMappings.slots[slot].enabled
                          ? `${slotTitle(slot)} enabled`
                          : `${slotTitle(slot)} muted`,
                      });
                    }}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}

async function loadManageSoundsData() {
  const [mappings, library, status] = await Promise.all([
    loadSoundMappings(),
    loadSoundLibrary(),
    loadInstallStatus(),
  ]);

  return {
    mappings,
    library,
    status,
    libraryById: new Map(library.sounds.map((sound) => [sound.id, sound])),
  };
}

function installHealthSubtitle(missing: string[]) {
  if (missing.length === 0) return "All managed sound files are installed";
  if (missing.length === 1) return `Missing 1 required item`;
  return `Missing ${missing.length} required items`;
}

function slotTitle(slot: SoundSlot) {
  return slot
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slotSubtitle(enabled: boolean, soundLabel: string | undefined) {
  if (!enabled) return "Muted";
  if (soundLabel) return soundLabel;
  return "Enabled with no sound assigned";
}

function slotAccessories(enabled: boolean, soundLabel: string | undefined) {
  if (!enabled) {
    return [{ tag: { value: "Muted", color: Color.SecondaryText } }];
  }

  if (!soundLabel) {
    return [{ tag: { value: "No Sound", color: Color.Orange } }];
  }

  return [{ tag: { value: "Enabled", color: Color.Green } }];
}

function iconForSlot(slot: SoundSlot, enabled: boolean) {
  if (!enabled) {
    return { source: Icon.SpeakerOff, tintColor: Color.SecondaryText };
  }

  switch (slot) {
    case "needs_input":
      return { source: Icon.ExclamationMark, tintColor: Color.Yellow };
    case "failure":
      return { source: Icon.XMarkCircle, tintColor: Color.Red };
    case "done":
      return { source: Icon.CheckCircle, tintColor: Color.Green };
    case "success":
      return { source: Icon.Checkmark, tintColor: Color.Green };
    case "running":
      return { source: Icon.Dot, tintColor: Color.Blue };
  }
}
