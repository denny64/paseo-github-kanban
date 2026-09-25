import type { PluginServerContext } from "@getpaseo/plugin/server";
import { archiveCard, createCard, loadBoard, moveCard } from "./server/board";
import { archiveCardRpc, boardSettings, createCardRpc, loadBoardRpc, moveCardRpc } from "./shared/board";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(boardSettings);
  server.handle(loadBoardRpc, loadBoard);
  server.handle(createCardRpc, createCard);
  server.handle(moveCardRpc, moveCard);
  server.handle(archiveCardRpc, archiveCard);
  return () => {};
}
