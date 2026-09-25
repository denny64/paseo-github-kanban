import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function gh(args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("gh", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 20_000,
    });
    return stdout;
  } catch (error) {
    const failure = error as { code?: unknown; message?: unknown; stderr?: unknown };
    if (failure.code === "ENOENT") {
      throw new Error(
        "GitHub CLI (gh) is not installed on the daemon machine. Install it and run `gh auth login`.",
      );
    }

    const stderr = typeof failure.stderr === "string" ? failure.stderr.trim() : "";
    const message = stderr || (error instanceof Error ? error.message : String(error));
    throw new Error(message);
  }
}
