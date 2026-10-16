import { Icon } from "@getpaseo/plugin/client/react-native";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Button, errorMessage, type Theme } from "./controls";
import { isWeb, onPasteFiles, pickFiles, readAsBase64, type WebFile } from "./web";

// What Paseo's agents.create takes: raw base64, no data: URL prefix.
export type AgentImage = { data: string; mimeType: string };

const isImage = (file: WebFile) => file.type.startsWith("image/");

// ponytail: web/desktop only; plugins get no native image picker, so the
// attach button and paste are hidden on mobile.
export const canAttachImages = isWeb;

// Images for the agent's first message, from a file picker or pasted while `active`.
export function useImages(active: boolean, onError: (message: string) => void) {
  const [images, setImages] = useState<AgentImage[]>([]);
  const add = (files: WebFile[]) => {
    const read = files.filter(isImage).map(async (file) => ({ mimeType: file.type, data: await readAsBase64(file) }));
    Promise.all(read).then(
      (read) => setImages((current) => [...current, ...read]),
      (error) => onError(`Couldn't read the image: ${errorMessage(error)}`),
    );
  };

  useEffect(() => {
    if (!active) return;
    return onPasteFiles((files) => {
      if (!files.some(isImage)) return false;
      add(files);
      return true;
    });
  }, [active]);

  const pick = () => pickFiles("image/*", add);

  return { images, pick, clear: () => setImages([]), remove: (index: number) => setImages((c) => c.filter((_, i) => i !== index)) };
}

export function ImageAttachments({ theme, images }: { theme: Theme; images: ReturnType<typeof useImages> }) {
  if (!canAttachImages) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {images.images.map((image, index) => (
        <View key={index}>
          <Image
            source={{ uri: `data:${image.mimeType};base64,${image.data}` }}
            style={{ width: 56, height: 56, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove image ${index + 1}`}
            onPress={() => images.remove(index)}
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              padding: 3,
              borderRadius: 999,
              backgroundColor: theme.colors.surface2,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Icon name="X" size={10} color={theme.colors.foreground} />
          </Pressable>
        </View>
      ))}
      <Button theme={theme} label="Add images" icon="ImagePlus" onPress={images.pick} />
      {images.images.length === 0 ? (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>or paste. Sent to the agent, not the issue.</Text>
      ) : null}
    </View>
  );
}
