import { Platform } from "react-native";

// The only DOM this plugin touches. The bundle also runs on iOS and Android,
// so tsconfig leaves out the DOM lib and every export is a no-op off the web.
export interface WebFile {
  readonly name: string;
  readonly type: string;
}
type PasteEvent = { clipboardData: { files: Iterable<WebFile> } | null; preventDefault(): void };
declare const document: {
  createElement(tag: "input"): {
    type: string;
    accept: string;
    multiple: boolean;
    files: Iterable<WebFile> | null;
    onchange: (() => void) | null;
    click(): void;
  };
  addEventListener(type: "paste", listener: (event: PasteEvent) => void): void;
  removeEventListener(type: "paste", listener: (event: PasteEvent) => void): void;
};
declare const FileReader: new () => {
  result: unknown;
  error: unknown;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  readAsDataURL(file: WebFile): void;
};

export const isWeb = Platform.OS === "web";

export function readAsBase64(file: WebFile): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error(`Couldn't read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function pickFiles(accept: string, onPick: (files: WebFile[]) => void) {
  if (!isWeb) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.multiple = true;
  input.onchange = () => onPick([...(input.files ?? [])]);
  input.click();
}

// Files pasted anywhere in the window; the handler returns true to take over the paste.
export function onPasteFiles(handler: (files: WebFile[]) => boolean): () => void {
  if (!isWeb) return () => {};
  const listener = (event: PasteEvent) => {
    if (handler([...(event.clipboardData?.files ?? [])])) event.preventDefault();
  };
  document.addEventListener("paste", listener);
  return () => document.removeEventListener("paste", listener);
}
