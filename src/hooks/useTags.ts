import { useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import {
  getTags,
  createTag,
  updateTag,
  deleteTag,
  addTagToRepo,
  removeTagFromRepo,
} from "@/lib/commands";

/**
 * 标签操作 hook。
 * 不再内部自动 fetch，由调用方显式触发 refresh。
 */
export function useTags() {
  const { tags, setTags } = useAppStore();

  const fetchTags = useCallback(async () => {
    try {
      const result = await getTags();
      setTags(result);
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    }
  }, [setTags]);

  const handleCreateTag = useCallback(
    async (name: string, color: string) => {
      try {
        await createTag(name, color);
        await fetchTags();
      } catch (err) {
        console.error("Failed to create tag:", err);
        throw err;
      }
    },
    [fetchTags]
  );

  const handleUpdateTag = useCallback(
    async (id: number, name: string, color: string) => {
      try {
        await updateTag(id, name, color);
        await fetchTags();
      } catch (err) {
        console.error("Failed to update tag:", err);
        throw err;
      }
    },
    [fetchTags]
  );

  const handleDeleteTag = useCallback(
    async (id: number) => {
      try {
        await deleteTag(id);
        await fetchTags();
      } catch (err) {
        console.error("Failed to delete tag:", err);
        throw err;
      }
    },
    [fetchTags]
  );

  const handleAddTagToRepo = useCallback(
    async (repoId: number, tagId: number) => {
      try {
        await addTagToRepo(repoId, tagId);
      } catch (err) {
        console.error("Failed to add tag to repo:", err);
        throw err;
      }
    },
    []
  );

  const handleRemoveTagFromRepo = useCallback(
    async (repoId: number, tagId: number) => {
      try {
        await removeTagFromRepo(repoId, tagId);
      } catch (err) {
        console.error("Failed to remove tag from repo:", err);
        throw err;
      }
    },
    []
  );

  return {
    tags,
    refresh: fetchTags,
    createTag: handleCreateTag,
    updateTag: handleUpdateTag,
    deleteTag: handleDeleteTag,
    addTagToRepo: handleAddTagToRepo,
    removeTagFromRepo: handleRemoveTagFromRepo,
  };
}
