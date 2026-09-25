import type { usePaseo } from "@getpaseo/plugin/client";

// Paseo SDK types, derived from the plugin SDK so plugin code only imports
// the modules Paseo provides to plugins.
export type PaseoApi = ReturnType<typeof usePaseo>;
export type PaseoProject = Awaited<ReturnType<PaseoApi["projects"]["list"]>>["projects"][number];
export type PaseoAgentConfig = Parameters<PaseoApi["agents"]["create"]>[0]["config"];
