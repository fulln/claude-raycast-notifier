import {
  Action,
  ActionPanel,
  Clipboard,
  closeMainWindow,
  Form,
  Icon,
  LaunchProps,
  List,
  open,
  showHUD,
} from "@raycast/api";
import { useState } from "react";
import { ClaudeActionOption, decodePayload } from "./lib/event";

type Arguments = { payload: string };

export default function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const event = decodePayload(props.arguments.payload);

  if (!event.action) {
    void showHUD(`${event.title}: ${event.message}`);
    void closeMainWindow();
    return null;
  }

  if (event.action.kind === "input") {
    return <InputActionView title={event.title} message={event.message} />;
  }

  return (
    <List
      navigationTitle={event.title}
      searchBarPlaceholder="Filter Claude choices"
      isShowingDetail
    >
      <List.Section title="Action Required" subtitle={event.message}>
        {(event.action.options ?? []).map((option) => (
          <List.Item
            key={option.id}
            icon={Icon.ExclamationMark}
            title={option.label}
            subtitle={option.detail}
            detail={
              <List.Item.Detail
                markdown={detailMarkdown(
                  event.title,
                  event.message,
                  option,
                  event.soundSlot,
                )}
              />
            }
            actions={
              <ActionPanel>
                <Action
                  title="Copy Choice and Open Claude"
                  onAction={() => copyAndReturn(option.label)}
                />
                <Action.CopyToClipboard
                  title="Copy Choice"
                  content={option.label}
                />
                <Action.Open title="Open Claude" target="claude://" />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function InputActionView(props: { title: string; message: string }) {
  const [value, setValue] = useState("");

  return (
    <Form
      navigationTitle={props.title}
      actions={
        <ActionPanel>
          <Action
            title="Copy Input and Open Claude"
            onAction={() => copyAndReturn(value)}
          />
          <Action.CopyToClipboard title="Copy Input" content={value} />
          <Action.Open title="Open Claude" target="claude://" />
        </ActionPanel>
      }
    >
      <Form.Description text={props.message} />
      <Form.TextArea
        id="response"
        title="Your Response"
        placeholder="Type the answer you want to send back in Claude Code"
        value={value}
        onChange={setValue}
      />
    </Form>
  );
}

function detailMarkdown(
  title: string,
  message: string,
  option: ClaudeActionOption,
  soundSlot: string,
) {
  return [
    `# ${title}`,
    "",
    message,
    "",
    `Sound slot: **${soundSlot}**`,
    "",
    `Selected option: **${option.label}**`,
  ].join("\n");
}

async function copyAndReturn(value: string) {
  await Clipboard.copy(value);
  await showHUD(`Copied: ${value}`);
  await open("claude://");
}
