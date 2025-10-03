import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  deleteSavedFiles,
  fetchModelFiles,
  fetchModelInfo,
  setupZippedTagModel,
} from "@/utils/autotag/management";
import { type WDTaggerModelInfo } from "@/utils/autotag/wd";
import {
  type AutotagWorker,
  createAutotagWorker,
} from "@/utils/autotag/worker";

import { jsonStorage } from "./storage";

export interface CommonTagModelMeta {
  // Name of the model.
  name: string;
  // URL of the info.json or metadata.json file, if the model is from the internet.
  url?: string;
}

export interface WDTaggerModelMeta extends CommonTagModelMeta {
  type: "wd";
  // Contents of the info.json file, if it has been loaded before
  info?: WDTaggerModelInfo;
  // Tag CSV path in OPFS, if the tags are cached
  tagsPath?: string;
  // Model path in OPFS, if the model is cached
  modelPath?: string;
}

export interface CamieTaggerModelMeta extends CommonTagModelMeta {
  type: "camie";
  // Metadata JSON path in OPFS, if the model is cached
  metadataPath?: string;
  // Model path in OPFS, if the metadata is cached
  modelPath?: string;
}

export type TagModelMeta = WDTaggerModelMeta | CamieTaggerModelMeta;

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
    "WD ViT Tagger v3": {
      name: "WD ViT Tagger v3",
      url: "https://models.hydrui.dev/wd-vit-tagger-v3/info.json",
      type: "wd",
    },
  },
  tagModelNames: ["WD ViT Tagger v3"],
};

export function isModelCached(meta: TagModelMeta) {
  switch (meta.type) {
    case "wd":
      return meta.info && meta.tagsPath && meta.modelPath;
    case "camie":
      return meta.metadataPath && meta.modelPath;
  }
}

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
          await deleteSavedFiles(model);
          delete model.modelPath;
          if (model.type === "wd") delete model.tagsPath;
          if (model.type === "camie") delete model.metadataPath;
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
          const newModel = await fetchModelFiles(model);
          set((state) => ({
            ...state,
            tagModels: {
              ...state.tagModels,
              [name]: newModel,
            },
          }));
          return newModel;
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
          await deleteSavedFiles(model);
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
            await deleteSavedFiles(model);
          }
          set({ ...INITIAL_STATE });
        },
        async loadTagModel(name: string): Promise<AutotagWorker> {
          let model = get().tagModels[name];
          if (!model) {
            throw new Error(`Model ${name} not found`);
          }
          if (!isModelCached(model)) {
            model = await get().actions.downloadTagModel(name);
          }
          const worker = await createAutotagWorker();
          await worker.loadModel(model);
          return worker;
        },
      },
    }),
    {
      name: "hydrui-model-meta",
      version: 1,
      storage: jsonStorage,
      // Only persist specific keys
      partialize: ({ tagModels, tagModelNames }) => ({
        tagModels,
        tagModelNames,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          // v0 did not contain the type field.
          // Populate it based on whether or not metadataPath is set.
          const stateV0 = persistedState as {
            tagModels?: Record<
              string,
              { metadataPath?: string; type?: string }
            >;
          };
          if (stateV0.tagModels) {
            for (const meta of Object.values(stateV0.tagModels)) {
              if (meta.metadataPath) {
                meta.type = "camie";
              } else {
                meta.type = "wd";
              }
            }
          }
        }
        return persistedState;
      },
    },
  ),
);
