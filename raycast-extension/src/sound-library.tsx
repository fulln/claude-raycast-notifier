import {
  Action,
  ActionPanel,
  Form,
  Icon,
  List,
  Toast,
  showToast,
  useNavigation,
  usePromise,
} from "@raycast/api";
import type { ReactElement } from "react";
import { useState } from "react";
import type { SoundSlot } from "./lib/event";
import {
  importSoundFile,
  loadSoundLibrary,
  loadSoundMappings,
  previewSoundFile,
  resolveManagedSoundPath,
  saveSoundMappings,
} from "./lib/sound-store";

type SoundLibraryViewProps = {
  slot?: SoundSlot;
  onAssigned?: () => void | Promise<void>;
};

type ImportSoundValues = {
  label: string;
  source: string[];
};

export function SoundLibraryView(props: SoundLibraryViewProps) {
  const { data, isLoading, revalidate } = usePromise(loadLibraryData, []);

  return (
    <List
      isLoading={isLoading}
      navigationTitle={
        props.slot
          ? `Choose Sound for ${slotTitle(props.slot)}`
          : "Claude Sound Library"
      }
      searchBarPlaceholder="Search Claude sounds"
    >
      <List.Section title="Bundled Sounds">
        {(data?.bundled ?? []).map((sound) => (
          <List.Item
            key={sound.id}
            icon={Icon.Box}
            title={sound.label}
            subtitle={sound.originalName ?? sound.filename}
            accessories={soundAccessories(sound.frequencyHz, sound.durationMs)}
            actions={
              <SoundActions
                slot={props.slot}
                soundId={sound.id}
                soundLabel={sound.label}
                filename={sound.filename}
                mappings={data?.mappings}
                onAssigned={props.onAssigned}
                onRefresh={revalidate}
              />
            }
          />
        ))}
      </List.Section>

      <List.Section title="Imported Sounds">
        {(data?.imported ?? []).map((sound) => (
          <List.Item
            key={sound.id}
            icon={Icon.Document}
            title={sound.label}
            subtitle={sound.originalName ?? sound.filename}
            accessories={soundAccessories(sound.frequencyHz, sound.durationMs)}
            actions={
              <SoundActions
                slot={props.slot}
                soundId={sound.id}
                soundLabel={sound.label}
                filename={sound.filename}
                mappings={data?.mappings}
                onAssigned={props.onAssigned}
                onRefresh={revalidate}
              />
            }
          />
        ))}
      </List.Section>

      <List.Section title="Library Actions">
        <List.Item
          icon={Icon.Plus}
          title="Import Sound File"
          subtitle="Add a custom sound to your managed library"
          actions={
            <ActionPanel>
              <Action.Push
                title="Import Sound File"
                icon={Icon.Plus}
                target={<ImportSoundForm onImported={revalidate} />}
              />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}

export default function Command() {
  return <SoundLibraryView />;
}

function SoundActions(props: {
  slot?: SoundSlot;
  soundId: string;
  soundLabel: string;
  filename: string;
  mappings: Awaited<ReturnType<typeof loadLibraryData>>["mappings"] | undefined;
  onAssigned?: () => void | Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  return (
    <ActionPanel>
      <Action
        title="Preview Sound"
        icon={Icon.Play}
        onAction={() =>
          previewSoundFile(resolveManagedSoundPath(props.filename))
        }
      />
      {props.slot && props.mappings ? (
        <Action
          title={`Assign to ${slotTitle(props.slot)}`}
          icon={Icon.CheckCircle}
          onAction={async () => {
            await saveSoundMappings({
              ...props.mappings,
              slots: {
                ...props.mappings.slots,
                [props.slot]: {
                  soundId: props.soundId,
                  enabled: true,
                },
              },
            });

            await props.onRefresh();
            await props.onAssigned?.();
            await showToast({
              style: Toast.Style.Success,
              title: `${props.soundLabel} assigned`,
              message: `${slotTitle(props.slot)} now uses this sound`,
            });
          }}
        />
      ) : null}
    </ActionPanel>
  );
}

function ImportSoundForm(props: {
  onImported: () => Promise<void>;
}): ReactElement {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pop } = useNavigation();

  return (
    <Form
      navigationTitle="Import Sound File"
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Import Sound"
            icon={Icon.Download}
            onSubmit={async (values: ImportSoundValues) => {
              const sourcePath = values.source[0];
              if (!sourcePath) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Choose a sound file to import",
                });
                return;
              }

              setIsSubmitting(true);
              try {
                await importSoundFile(sourcePath, values.label);
                await props.onImported();
                await showToast({
                  style: Toast.Style.Success,
                  title: "Sound imported",
                  message: values.label,
                });
                pop();
              } finally {
                setIsSubmitting(false);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="label" title="Label" placeholder="Alert Chime" />
      <Form.FilePicker
        id="source"
        title="Source File"
        allowMultipleSelection={false}
      />
    </Form>
  );
}

async function loadLibraryData() {
  const [library, mappings] = await Promise.all([
    loadSoundLibrary(),
    loadSoundMappings(),
  ]);

  return {
    bundled: library.sounds.filter((sound) => sound.kind === "bundled"),
    imported: library.sounds.filter((sound) => sound.kind === "imported"),
    mappings,
  };
}

function soundAccessories(
  frequencyHz: number | undefined,
  durationMs: number | undefined,
) {
  const accessories: Array<{ tag: string }> = [];

  if (typeof frequencyHz === "number") {
    accessories.push({ tag: `${frequencyHz} Hz` });
  }

  if (typeof durationMs === "number") {
    accessories.push({ tag: `${durationMs} ms` });
  }

  return accessories;
}

function slotTitle(slot: SoundSlot) {
  return slot
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
