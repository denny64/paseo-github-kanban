import { useRpc } from "@getpaseo/plugin/client";
import { Modal, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import { type Card, createCardRpc } from "../shared/board";
import { Button, errorMessage, inputStyle, type Theme } from "./controls";

export function NewCardModal({
  theme,
  open,
  repo,
  onOpenChange,
  onCreated,
}: {
  theme: Theme;
  open: boolean;
  repo: string;
  onOpenChange(open: boolean): void;
  onCreated(card: Card): void;
}) {
  const toast = useToast();
  const createCard = useRpc(createCardRpc);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: createCard,
    onSuccess: (card) => {
      onCreated(card);
      setTitle("");
      setBody("");
      onOpenChange(false);
    },
    onError: (error) => toast.error(`Couldn't create the card: ${errorMessage(error)}`),
  });
  const submit = () => title.trim() && !create.isPending && create.mutate({ repo, title, body });

  return (
    <Modal title="New card" open={open} onOpenChange={onOpenChange}>
      <Modal.Content>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>Creates an issue in {repo}.</Text>
        <TextInput
          accessibilityLabel="Title"
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={submit}
          placeholder="Title"
          placeholderTextColor={theme.colors.foregroundMuted}
          autoFocus
          style={inputStyle(theme)}
        />
        <TextInput
          accessibilityLabel="Description"
          value={body}
          onChangeText={setBody}
          placeholder="Description (Markdown, optional)"
          placeholderTextColor={theme.colors.foregroundMuted}
          multiline
          style={inputStyle(theme, true)}
        />
        <View style={{ flexDirection: "row" }}>
          <Button
            theme={theme}
            label={create.isPending ? "Creating…" : "Create card"}
            icon="Plus"
            primary
            disabled={!title.trim() || create.isPending}
            onPress={submit}
          />
        </View>
      </Modal.Content>
    </Modal>
  );
}
