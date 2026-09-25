import type { PaseoProject } from "./paseo-types";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { type Card, type ColumnId, loadBoardRpc, moveCardRpc, type Repo } from "../shared/board";

type Board = { repo: Repo; cards: Card[] };

// A card plus where it lives, so one view can mix repos.
export type BoardCard = Card & { key: string; repo: Repo; project: PaseoProject };

const boardKey = (project: PaseoProject) => ["board", project.projectRootPath];

// GitHub's own cross-repo reference ("found_scraper#12") when repos are mixed.
export function cardRef(card: BoardCard, showRepo: boolean): string {
  return showRepo ? `${card.repo.nameWithOwner.split("/")[1]}#${card.number}` : `#${card.number}`;
}

// One query per project, shared with the single-project view's cache.
export function useBoards(projects: readonly PaseoProject[], refetchInterval: number) {
  const loadBoard = useRpc(loadBoardRpc);
  const queries = useQueries({
    queries: projects.map((project) => ({
      queryKey: boardKey(project),
      queryFn: () => loadBoard({ cwd: project.projectRootPath }),
      refetchInterval,
      staleTime: 30_000,
    })),
  });

  const cards: BoardCard[] = [];
  const repos: { project: PaseoProject; repo: Repo }[] = [];
  const failed: { project: PaseoProject; error: unknown }[] = [];
  queries.forEach((query, index) => {
    const project = projects[index];
    if (query.error) failed.push({ project, error: query.error });
    // Two checkouts of the same repo would show every card twice; keep the first.
    if (!query.data || repos.some((r) => r.repo.nameWithOwner === query.data.repo.nameWithOwner)) return;
    const { repo } = query.data;
    repos.push({ project, repo });
    for (const card of query.data.cards) cards.push({ ...card, key: `${repo.nameWithOwner}#${card.number}`, repo, project });
  });
  cards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    cards,
    repos,
    failed,
    // Show whatever has arrived rather than waiting on the slowest repo.
    ready: queries.some((q) => q.data) || queries.every((q) => !q.isPending),
    fetching: queries.some((q) => q.isFetching),
    refetch: () => Promise.all(queries.map((q) => q.refetch())),
  };
}

export function usePutCard() {
  const queryClient = useQueryClient();
  return (project: PaseoProject, card: Card) =>
    queryClient.setQueryData<Board>(boardKey(project), (board) =>
      board && {
        ...board,
        cards: board.cards.some((c) => c.number === card.number)
          ? board.cards.map((c) => (c.number === card.number ? card : c))
          : [card, ...board.cards],
      },
    );
}

export function useMoveCard(onError: (error: unknown) => void) {
  const queryClient = useQueryClient();
  const moveCard = useRpc(moveCardRpc);
  const putCard = usePutCard();
  return useMutation({
    mutationFn: ({ card, column }: { card: BoardCard; column: ColumnId }) =>
      moveCard({ repo: card.repo.nameWithOwner, number: card.number, column }),
    onMutate: async ({ card, column }) => {
      const { key: _key, repo: _repo, project, ...data } = card;
      await queryClient.cancelQueries({ queryKey: boardKey(project) });
      const previous = queryClient.getQueryData<Board>(boardKey(project));
      putCard(project, { ...data, column });
      return { previous };
    },
    onError: (error, { card }, context) => {
      queryClient.setQueryData(boardKey(card.project), context?.previous);
      onError(error);
    },
    onSuccess: (updated, { card }) => putCard(card.project, updated),
  });
}
