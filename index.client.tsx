import type { PluginClientContext } from "@getpaseo/plugin/client";
import { BoardSurface } from "./client/board";

export default function contribute(client: PluginClientContext) {
  client.addSurface("board", BoardSurface);
  client.addSidebarItem({ id: "board", title: "Kanban", icon: "SquareKanban", surface: "board" });
  return () => {};
}
