import type { PaseoProject } from "@getpaseo/client";
import { useRpc } from "@getpaseo/plugin/client";
import { Modal, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import { SettingsCard, SettingsSelect } from "@getpaseo/plugin/client/ui";
import { type Card, createCardRpc, type Repo } from "../shared/board";
import { Button, errorMessage, inputStyle, type Theme } from "./controls";

export function NewCardModal({
  theme,
  open,
  targets,
  defaultProjectId,
  onOpenChange,
  onCreated,
}: {
  theme: Theme;
  open: boolean;
  // Repos the new issue can go to: one on a project board, all of them on "All projects".
  targets: { project: PaseoProject; repo: Repo }[];
  defaultProjectId?: string;
  onOpenChange(open: boolean): void;
  onCreated(project: PaseoProject, card: Card): void;
}) {
  const toast = useToast();
  const createCard = useRpc(createCardRpc);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const target =
    targets.find((t) => t.project.projectId === (picked ?? defaultProjectId)) ?? targets[0];
  const repo = target.repo.nameWithOwner;
  const create = useMutation({
    mutationFn: createCard,
    onSuccess: (card) => {
      onCreated(target.project, card);
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
        {targets.length > 1 ? (
          <SettingsCard>
            <SettingsSelect
              label="Project"
              value={target.project.projectId}
              options={targets.map((t) => ({ label: t.project.projectDisplayName, value: t.project.projectId }))}
              onValueChange={setPicked}
            />
          </SettingsCard>
        ) : null}
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
