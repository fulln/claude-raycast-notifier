import { environment, getPreferenceValues } from "@raycast/api";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";
import type { SoundSlot } from "./event";

const execFileAsync = promisify(execFile);
const SOUND_SLOTS: SoundSlot[] = [
  "running",
  "needs_input",
  "success",
  "failure",
  "done",
];
const LIBRARY_VERSION = 1;
const MAPPINGS_VERSION = 1;

type Preferences = {
  notifierRootPath: string;
};

type SoundKind = "bundled" | "imported";

export type SoundLibraryEntry = {
  id: string;
  label: string;
  kind: SoundKind;
  filename: string;
  frequencyHz?: number;
  durationMs?: number;
  originalName?: string;
};

export type SoundLibrary = {
  version: number;
  sounds: SoundLibraryEntry[];
};

export type SoundMapping = {
  soundId: string | null;
  enabled: boolean;
};

export type SoundMappings = {
  version: number;
  slots: Record<SoundSlot, SoundMapping>;
};

export type InstallStatus = {
  rootDir: string;
  missing: string[];
  healthy: boolean;
};

export async function loadSoundLibrary(): Promise<SoundLibrary> {
  const { libraryFile } = notifierPaths();
  const parsed = await readJsonFile<Partial<SoundLibrary>>(libraryFile, {
    version: LIBRARY_VERSION,
    sounds: [],
  });

  return normalizeLibrary(parsed);
}

export async function loadSoundMappings(): Promise<SoundMappings> {
  const { mappingsFile } = notifierPaths();
  const parsed = await readJsonFile<Partial<SoundMappings>>(mappingsFile, {
    version: MAPPINGS_VERSION,
    slots: defaultMappings().slots,
  });

  return normalizeMappings(parsed);
}

export async function saveSoundMappings(
  mappings: SoundMappings,
): Promise<SoundMappings> {
  const { mappingsFile } = notifierPaths();
  const normalized = normalizeMappings(mappings);
  await writeJsonFile(mappingsFile, normalized);
  return normalized;
}

export async function importSoundFile(
  sourcePath: string,
  label: string,
): Promise<SoundLibraryEntry> {
  const paths = notifierPaths();
  await fs.mkdir(paths.soundsDir, { recursive: true });

  const extension = extname(sourcePath) || ".wav";
  const filename = `${randomUUID()}${extension}`;
  const destination = join(paths.soundsDir, filename);

  await fs.copyFile(sourcePath, destination);

  const entry: SoundLibraryEntry = {
    id: `imported-${randomUUID()}`,
    label,
    kind: "imported",
    filename,
    originalName: basename(sourcePath),
  };

  const library = await loadSoundLibrary();
  await writeJsonFile(paths.libraryFile, {
    version: LIBRARY_VERSION,
    sounds: [...library.sounds, entry],
  });

  return entry;
}

export async function previewSoundFile(filePath: string): Promise<void> {
  await execFileAsync("afplay", [filePath]);
}

export async function repairUserData(): Promise<{
  library: SoundLibrary;
  mappings: SoundMappings;
  status: InstallStatus;
}> {
  const paths = notifierPaths();
  await fs.mkdir(paths.rootDir, { recursive: true });
  await fs.mkdir(paths.soundsDir, { recursive: true });

  const manifest = await readJsonFile<DefaultSoundPack>(
    defaultSoundPackPath(),
    {
      version: LIBRARY_VERSION,
      sounds: [],
      defaults: {},
    },
  );

  for (const sound of manifest.sounds ?? []) {
    const source = resolve(environment.assetsPath, "sounds", sound.filename);
    const destination = join(paths.soundsDir, sound.filename);
    if (!(await pathExists(destination)) && (await pathExists(source))) {
      await fs.copyFile(source, destination);
    }
  }

  const existingLibrary = await loadSoundLibrary();
  const importedSounds = existingLibrary.sounds.filter(
    (sound) => sound.kind === "imported",
  );
  const bundledSounds = (manifest.sounds ?? []).map((sound) => ({
    id: sound.id,
    label: sound.label,
    kind: "bundled" as const,
    filename: sound.filename,
    frequencyHz: sound.frequencyHz,
    durationMs: sound.durationMs,
  }));
  const library = normalizeLibrary({
    version: LIBRARY_VERSION,
    sounds: [...bundledSounds, ...importedSounds],
  });
  await writeJsonFile(paths.libraryFile, library);

  if (!(await pathExists(paths.mappingsFile))) {
    const mappings = normalizeMappings({
      version: MAPPINGS_VERSION,
      slots: Object.fromEntries(
        SOUND_SLOTS.map((slot) => [
          slot,
          manifest.defaults?.[slot] ?? defaultMapping(),
        ]),
      ) as Record<SoundSlot, SoundMapping>,
    });
    await writeJsonFile(paths.mappingsFile, mappings);
  }

  return {
    library: await loadSoundLibrary(),
    mappings: await loadSoundMappings(),
    status: await loadInstallStatus(),
  };
}

export async function loadInstallStatus(): Promise<InstallStatus> {
  const paths = notifierPaths();
  const missing: string[] = [];

  for (const candidate of [
    paths.rootDir,
    paths.soundsDir,
    paths.libraryFile,
    paths.mappingsFile,
  ]) {
    if (!(await pathExists(candidate))) {
      missing.push(candidate);
    }
  }

  return {
    rootDir: paths.rootDir,
    missing,
    healthy: missing.length === 0,
  };
}

export function resolveManagedSoundPath(filename: string): string {
  return join(notifierPaths().soundsDir, filename);
}

function notifierPaths() {
  const preferences = getPreferenceValues<Preferences>();
  const rootDir = expandHome(preferences.notifierRootPath);

  return {
    rootDir,
    soundsDir: join(rootDir, "sounds"),
    libraryFile: join(rootDir, "sound-library.json"),
    mappingsFile: join(rootDir, "sound-mappings.json"),
    stateFile: join(rootDir, "state.json"),
  };
}

function expandHome(path: string): string {
  return path.replace(/^~(?=\/)/, homedir());
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function normalizeLibrary(
  value: Partial<SoundLibrary> | undefined,
): SoundLibrary {
  return {
    version:
      typeof value?.version === "number" ? value.version : LIBRARY_VERSION,
    sounds: Array.isArray(value?.sounds)
      ? value.sounds.filter(isSoundLibraryEntry)
      : [],
  };
}

function normalizeMappings(
  value: Partial<SoundMappings> | undefined,
): SoundMappings {
  const slots = value?.slots ?? {};

  return {
    version:
      typeof value?.version === "number" ? value.version : MAPPINGS_VERSION,
    slots: Object.fromEntries(
      SOUND_SLOTS.map((slot) => [slot, normalizeMapping(slots[slot])]),
    ) as Record<SoundSlot, SoundMapping>,
  };
}

function normalizeMapping(
  value: Partial<SoundMapping> | undefined,
): SoundMapping {
  return {
    soundId: typeof value?.soundId === "string" ? value.soundId : null,
    enabled: Boolean(value?.enabled),
  };
}

function defaultMappings(): SoundMappings {
  return {
    version: MAPPINGS_VERSION,
    slots: Object.fromEntries(
      SOUND_SLOTS.map((slot) => [slot, defaultMapping()]),
    ) as Record<SoundSlot, SoundMapping>,
  };
}

function defaultMapping(): SoundMapping {
  return { soundId: null, enabled: false };
}

function isSoundLibraryEntry(value: unknown): value is SoundLibraryEntry {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    (candidate.kind === "bundled" || candidate.kind === "imported") &&
    typeof candidate.filename === "string"
  );
}

function defaultSoundPackPath(): string {
  return resolve(
    environment.assetsPath,
    "..",
    "config",
    "default-sound-pack.json",
  );
}

type DefaultSoundPack = {
  version: number;
  sounds: Array<{
    id: string;
    label: string;
    filename: string;
    frequencyHz?: number;
    durationMs?: number;
  }>;
  defaults?: Partial<Record<SoundSlot, SoundMapping>>;
};
