import * as React from "react";
import type { BrowseDialogType } from "@/app/AppShellOverlays";
import type { useCreateChannelMutation } from "@/features/channels/hooks";
import type { useApplyTemplate } from "@/features/channel-templates/useApplyTemplate";
import type { ChannelVisibility } from "@/shared/api/types";

type CreateChannelMutation = ReturnType<typeof useCreateChannelMutation>;
type ApplyTemplate = ReturnType<typeof useApplyTemplate>;

/** Shared shape for the create-channel and create-forum dialogs. */
export type CreateChannelInput = {
  name: string;
  description?: string;
  visibility: ChannelVisibility;
  ttlSeconds?: number;
  templateId?: string;
};

type UseChannelCreationHandlersOptions = {
  createChannelMutation: CreateChannelMutation;
  createForumMutation: CreateChannelMutation;
  applyCanvas: ApplyTemplate["applyCanvas"];
  applyAgents: ApplyTemplate["applyAgents"];
  // Navigate to the freshly created channel. Return value (goChannel resolves
  // to a did-navigate boolean) is intentionally ignored here.
  goChannel: (channelId: string) => Promise<unknown> | unknown;
  browseDialogType: BrowseDialogType;
  getCreateSuccess: () => ((channelId: string) => void) | null;
};

/**
 * The channel/forum creation callbacks lifted out of AppShell — a cohesive
 * cluster (create stream, create forum, and the browser's route-to-either
 * variant) that shares the template-apply + navigate flow. Extracted so the
 * composition root stays under the file-size ceiling; behavior is unchanged.
 */
export function useChannelCreationHandlers({
  createChannelMutation,
  createForumMutation,
  applyCanvas,
  applyAgents,
  goChannel,
  browseDialogType,
  getCreateSuccess,
}: UseChannelCreationHandlersOptions) {
  const handleCreateChannel = React.useCallback(
    async (
      {
        description,
        name,
        visibility,
        ttlSeconds,
        templateId,
      }: CreateChannelInput,
      onCreated?: (channelId: string) => void,
    ) => {
      const createdChannel = await createChannelMutation.mutateAsync({
        name,
        description,
        channelType: "stream",
        visibility,
        ttlSeconds,
      });

      await applyCanvas(templateId, createdChannel.id, name);
      await goChannel(createdChannel.id);
      onCreated?.(createdChannel.id);
      void applyAgents(templateId, createdChannel.id);
    },
    [applyAgents, applyCanvas, createChannelMutation, goChannel],
  );

  const handleCreateForum = React.useCallback(
    async ({
      description,
      name,
      visibility,
      ttlSeconds,
      templateId,
    }: CreateChannelInput) => {
      const createdForum = await createForumMutation.mutateAsync({
        name,
        description,
        channelType: "forum",
        visibility,
        ttlSeconds,
      });

      await applyCanvas(templateId, createdForum.id, name);
      await goChannel(createdForum.id);
      void applyAgents(templateId, createdForum.id);
    },
    [applyAgents, applyCanvas, createForumMutation, goChannel],
  );

  // The channel browser can create either a stream or a forum depending on
  // which section opened it. Route to the matching handler.
  const handleBrowseChannelCreate = React.useCallback(
    async (input: CreateChannelInput) => {
      if (browseDialogType === "forum") {
        await handleCreateForum(input);
      } else {
        await handleCreateChannel(input, getCreateSuccess() ?? undefined);
      }
    },
    [
      browseDialogType,
      handleCreateChannel,
      handleCreateForum,
      getCreateSuccess,
    ],
  );

  return { handleCreateChannel, handleCreateForum, handleBrowseChannelCreate };
}
