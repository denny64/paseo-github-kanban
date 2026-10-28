import type { PluginServerContext } from "@getpaseo/plugin/server";
import { archiveCard, createCard, loadBoard, moveCard } from "./server/board";
import { cancelSchedule, createSchedule, listSchedules, rememberPaseo, runDueSchedules } from "./server/schedules";
import {
  archiveCardRpc,
  boardSettings,
  cancelScheduleRpc,
  createCardRpc,
  createScheduleRpc,
  listSchedulesRpc,
  loadBoardRpc,
  moveCardRpc,
} from "./shared/board";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(boardSettings);
  server.handle(loadBoardRpc, (input, context) => {
    rememberPaseo(context);
    return loadBoard(input);
  });
  server.handle(createCardRpc, createCard);
  server.handle(moveCardRpc, moveCard);
  server.handle(archiveCardRpc, archiveCard);
  server.handle(createScheduleRpc, createSchedule);
  server.handle(listSchedulesRpc, listSchedules);
  server.handle(cancelScheduleRpc, cancelSchedule);
  // Agent activity also hands over a Paseo API, so schedules fire after a
  // daemon restart even if nobody opens the board.
  const unsubscribe = [
    server.on("agent.created", (_event, context) => rememberPaseo(context)),
    server.on("agent.turn_ended", (_event, context) => rememberPaseo(context)),
  ];
  const timer = setInterval(() => void runDueSchedules(), 30_000);
  return () => {
    clearInterval(timer);
    for (const off of unsubscribe) off();
  };
}
