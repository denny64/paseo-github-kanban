import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createCard, loadBoard, moveCard } from "./server/board";
import { boardSettings, createCardRpc, loadBoardRpc, moveCardRpc } from "./shared/board";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(boardSettings);
  server.handle(loadBoardRpc, loadBoard);
  server.handle(createCardRpc, createCard);
  server.handle(moveCardRpc, moveCard);
  return () => {};
}
