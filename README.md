# GitHub Kanban for Paseo

A kanban board for [Paseo](https://paseo.sh) that stores everything in GitHub issues on the project's own repository. It has no database, no extra service and no token to set up.

Each card is an issue. Pick a card, choose an agent, and Paseo starts it in a new worktree with the issue attached.

## Install

```bash
paseo plugin add denny64/paseo-github-kanban
```

Open **Kanban** in the Paseo sidebar and choose a project.

This plugin needs:

- Paseo 0.9.2 or later.
- The [GitHub CLI](https://cli.github.com) installed and signed in (`gh auth login`) on the machine running the Paseo daemon.
- A git project whose remote is on GitHub.

## How the board maps to GitHub

| Column      | GitHub issue                         |
| ----------- | ------------------------------------ |
| To do       | Open, without a kanban label         |
| In progress | Open, labelled `kanban:in-progress`  |
| In review   | Open, with an open pull request that closes it, or labelled `kanban:in-review` |
| Done        | Closed as completed                  |

Drag a card to another column to move it. On touch screens, long-press it first, and on a phone drop it on the column tabs. You can also use the buttons in the card view. Moving a card changes its label, or closes or reopens the issue. You can manage the same board from GitHub, the `gh` CLI, or an agent. The labels are created the first time you move a card.

In the card view, **Close issue** closes it as completed and the card moves to Done. **Archive** hides the card. An open issue is closed as "not planned". A done issue stays closed as completed and gets the `kanban:archived` label. Reopen the issue, or remove the label, on GitHub to bring it back.

To clear out Done, use the archive button on a done card or **Clear** in the Done column's heading.

**New card** creates an issue. The board refreshes every minute and when you press refresh.

Choose **All projects** in the project picker to see every git project's issues on one board. Cards show GitHub's cross-repo reference, such as `api#12`. "New card" asks which project the issue belongs to. Projects that share a GitHub repo appear once. The combined board refreshes every 5 minutes instead of every minute.

The toggle in the header switches between the board and a **list view**. The list shows every card on one page, grouped by column, with its labels, assignee and last update. Paseo remembers which view you chose.

## Starting an agent

Press the ▶ button on a card or list row, or open the card, choose an agent and edit the first message if you want, then press **Start agent**. The plugin:

1. Creates a workspace on a new worktree branched from the project.
2. Starts the agent there with the issue attached.
3. Moves the card to **In progress**.

By default the first message tells the agent to open a pull request that includes `Closes #N`. The card then moves on its own:

- When the pull request opens, the card moves to **In review**, because GitHub links the pull request to the issue.
- When the pull request merges, GitHub closes the issue and the card moves to **Done**.

## Limitations

- The board shows up to 500 open issues and the 30 most recently closed ones.
- Dragging moves a card between columns but not within one, because GitHub issues have no manual order.
- Cards are sorted by last update.
- While a card has an open pull request, it stays in **In review**. Dragging it to another column won't stick until the pull request is merged or closed.

## Development

```bash
npm install
npm run typecheck
npm test
paseo plugin install "$PWD"      # then: paseo plugin reload paseo-github-kanban
```

## License

MIT
