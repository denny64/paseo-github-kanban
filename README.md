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
| In review   | Open, labelled `kanban:in-review`    |
| Done        | Closed as completed                  |

Moving a card changes its label, or closes or reopens the issue. You can manage the same board from GitHub, the `gh` CLI, or an agent. The labels are created the first time you move a card.

**New card** creates an issue. The board refreshes every minute and when you press refresh.

## Starting an agent

Open a card, choose an agent and edit the first message if you want, then press **Start agent**. The plugin:

1. Creates a workspace on a new worktree branched from the project.
2. Starts the agent there with the issue attached.
3. Moves the card to **In progress**.

By default the first message tells the agent to open a pull request that includes `Closes #N` and to move the card to **In review** with `gh issue edit`. When the pull request merges, GitHub closes the issue and the card moves to **Done**.

## Limits

- The board shows up to 500 open issues and the 30 most recently closed ones.
- Cards move between columns with the buttons in the card view. You can't drag them yet.
- Cards are sorted by last update. GitHub issues have no manual order.

## Development

```bash
npm install
npm run typecheck
npm test
paseo plugin install "$PWD"      # then: paseo plugin reload paseo-github-kanban
```

## License

MIT
