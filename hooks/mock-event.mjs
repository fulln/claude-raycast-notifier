const type = process.argv[2] ?? "needs_input";

const event = {
  needs_input: {
    type: "needs_input",
    title: "Claude needs your input",
    message: "Approve the command in Claude Code",
  },
  failure: {
    type: "failure",
    title: "Claude hit an error",
    message: "The last command failed",
  },
  done: {
    type: "done",
    title: "Claude finished the task",
    message: "Implementation and checks are complete",
  },
}[type];

if (!event) {
  console.error(`Unknown event type: ${type}`);
  process.exit(1);
}

process.stdout.write(JSON.stringify(event));
