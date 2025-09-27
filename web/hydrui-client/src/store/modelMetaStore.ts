import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  Session,
  deleteSavedFiles as deleteSavedTagModelFiles,
  fetchModelFiles,
  fetchModelInfo,
  loadModel,
  setupZippedTagModel,
} from "@/utils/modelManager";

import { jsonStorage } from "./storage";

export interface TagModelInfo {
  modelname: string;
  source: string;
  modelfile: string;
  tagsfile: string;
  ratingsflag: number;
  numberofratings: number;
}

export interface TagModelMeta {
  // Name of the model.
  name: string;
  // URL of the info.json file, if the model is from the internet.
  url?: string;
  // Contents of the info.json file, if it has been loaded before
  info?: TagModelInfo;
  // Model path in OPFS, if the model is cached
  modelPath?: string;
  // Tag CSV path in OPFS, if the tags are cached
  tagsPath?: string;
}

interface ModelMeta {
  tagModels: Record<string, TagModelMeta>;
  tagModelNames: string[];

  actions: {
    installTagModelFromUrl: (url: string) => Promise<void>;
    installTagModelFromBlob: (blob: Blob) => Promise<void>;
    clearInstalledFiles: (name: string) => Promise<void>;
    downloadTagModel: (name: string) => Promise<TagModelMeta>;
    addTagModel: (meta: TagModelMeta) => void;
    uninstallTagModel: (name: string) => Promise<void>;
    resetTagModels: () => Promise<void>;
    loadTagModel: (name: string) => Promise<Session>;
  };
}

const INITIAL_STATE: Omit<ModelMeta, "actions"> = {
  tagModels: {
    "WD V1.4 Vit V2 Tagger": {
      name: "WD V1.4 Vit V2 Tagger",
      url: "https://models.hydrui.dev/wd-v1-4-vit-tagger-v2/info.json",
    },
  },
  tagModelNames: ["WD V1.4 Vit V2 Tagger"],
};

export const useModelMetaStoreActions = () =>
  useModelMetaStore((state) => state.actions);

export const useModelMetaStore = create<ModelMeta>()(
  persist(
    (set, get) => ({
      // Initial state
      ...INITIAL_STATE,

      // Actions
      actions: {
        async installTagModelFromUrl(url: string): Promise<void> {
          get().actions.addTagModel(await fetchModelInfo(url));
        },
        async installTagModelFromBlob(blob: Blob): Promise<void> {
          get().actions.addTagModel(await setupZippedTagModel(blob));
        },
        async clearInstalledFiles(name: string): Promise<void> {
          const model = { ...get().tagModels[name] };
          if (!model) {
            return;
          }
          await deleteSavedTagModelFiles(model);
          delete model.modelPath;
          delete model.tagsPath;
          set((state) => ({
            ...state,
            tagModels: {
              ...state.tagModels,
              [name]: model,
            },
          }));
        },
        async downloadTagModel(name: string): Promise<TagModelMeta> {
          const model = { ...get().tagModels[name] };
          if (!model) {
            throw new Error(`Model ${name} not found.`);
          }
          await fetchModelFiles(model);
          set((state) => ({
            ...state,
            tagModels: {
              ...state.tagModels,
              [name]: model,
            },
          }));
          return model;
        },
        addTagModel(meta: TagModelMeta): void {
          set((state) => ({
            ...state,
            tagModels: {
              ...state.tagModels,
              [meta.name]: meta,
            },
            tagModelNames:
              state.tagModelNames.indexOf(meta.name) === -1
                ? [...state.tagModelNames, meta.name]
                : state.tagModelNames,
          }));
        },
        async uninstallTagModel(name: string): Promise<void> {
          const model = get().tagModels[name];
          if (!model) {
            return;
          }
          await deleteSavedTagModelFiles(model);
          set((state) => {
            const newTagModels = { ...state.tagModels };
            delete newTagModels[name];
            return {
              ...state,
              tagModels: newTagModels,
              tagModelNames: state.tagModelNames.filter((n) => n !== name),
            };
          });
        },
        async resetTagModels(): Promise<void> {
          const state = get();
          for (const model of Object.values(state.tagModels)) {
            await deleteSavedTagModelFiles(model);
          }
          set({ ...INITIAL_STATE });
        },
        async loadTagModel(name: string): Promise<Session> {
          let model = get().tagModels[name];
          if (!model.modelPath || !model.tagsPath || !model.info) {
            model = await get().actions.downloadTagModel(name);
          }
          if (!model) {
            throw new Error(`Model ${name} not found`);
          }
          return loadModel(model);
        },
      },
    }),
    {
      name: "hydrui-model-meta",
      storage: jsonStorage,
      // Only persist specific keys
      partialize: ({ tagModels, tagModelNames }) => ({
        tagModels,
        tagModelNames,
      }),
    },
  ),
);
