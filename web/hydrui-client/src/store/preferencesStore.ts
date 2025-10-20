import { create } from "zustand";
import { persist } from "zustand/middleware";

import { HydrusFileType, filetypeFromMime } from "@/constants/filetypes";

import { jsonStorage } from "./storage";

// Default tag namespace colors
const DEFAULT_TAG_COLORS: Record<string, string> = {
  character: "#00aa00",
  creator: "#aa0000",
  meta: "#000000",
  person: "#008000",
  series: "#aa00aa",
  studio: "#800000",
  system: "#996515",
};

export const DEFAULT_NAMESPACED_COLOR = "#72a0c1";
const DEFAULT_UNNAMESPACED_COLOR = "#006ffa";

const DEFAULT_AUTOPREVIEW_FILE_TYPES: HydrusFileType[] = [
  HydrusFileType.IMAGE_PNG,
  HydrusFileType.IMAGE_JPEG,
  HydrusFileType.IMAGE_GIF,
  HydrusFileType.IMAGE_WEBP,
  HydrusFileType.IMAGE_AVIF,
  HydrusFileType.IMAGE_HEIC,
  HydrusFileType.ANIMATION_APNG,
  HydrusFileType.ANIMATION_GIF,
  HydrusFileType.ANIMATION_WEBP,
];

const DEFAULT_THUMBNAIL_SIZE = 100;

interface TagColorPreferences {
  namespaceColors: Record<string, string>;
  defaultNamespacedColor: string;
  defaultUnnamespacedColor: string;
}

interface PreferencesState {
  tagColors: TagColorPreferences;
  autopreviewFileTypes: Set<HydrusFileType>;
  fileTypeViewerOverride: Map<HydrusFileType, string>;
  fileTypePreviewerOverride: Map<HydrusFileType, string>;
  fileTypeRendererOverride: Map<HydrusFileType, string>;
  thumbnailSize: number;
  useVirtualViewport: boolean;
  allowTokenPassing: boolean;
  eagerLoadThreshold: number;
  actions: {
    setNamespaceColor: (namespace: string, color: string) => void;
    clearNamespaceColor: (namespace: string) => void;
    setDefaultNamespacedColor: (color: string) => void;
    setDefaultUnnamespacedColor: (color: string) => void;
    resetNamespaceColors: () => void;
    addAutopreviewFileType: (filetype: HydrusFileType) => void;
    removeAutopreviewFileType: (filetype: HydrusFileType) => void;
    resetAutopreviewFileTypes: () => void;
    setThumbnailSize: (size: number) => void;
    setVirtualViewport: (enabled: boolean) => void;
    setAllowTokenPassing: (enabled: boolean) => void;
    setEagerLoadThreshold: (eagerLoadThreshold: number) => void;
    setFileTypeViewerOverride: (
      filetype: HydrusFileType,
      viewer: string,
    ) => void;
    deleteFileTypeViewerOverride: (filetype: HydrusFileType) => void;
    clearFileTypeViewerOverrides: () => void;
    setFileTypePreviewerOverride: (
      filetype: HydrusFileType,
      viewer: string,
    ) => void;
    deleteFileTypePreviewerOverride: (filetype: HydrusFileType) => void;
    clearFileTypePreviewerOverrides: () => void;
    setFileTypeRendererOverride: (
      filetype: HydrusFileType,
      renderer: string,
    ) => void;
    deleteFileTypeRendererOverride: (filetype: HydrusFileType) => void;
    clearFileTypeRendererOverrides: () => void;
  };
}

export const usePreferencesActions = () =>
  usePreferencesStore((state) => state.actions);

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      // Tag color preferences with defaults
      tagColors: {
        namespaceColors: { ...DEFAULT_TAG_COLORS },
        defaultNamespacedColor: DEFAULT_NAMESPACED_COLOR,
        defaultUnnamespacedColor: DEFAULT_UNNAMESPACED_COLOR,
      },

      // Mime types to automatically load previews for
      autopreviewFileTypes: new Set(DEFAULT_AUTOPREVIEW_FILE_TYPES),

      // Thumbnail size to use in page views
      thumbnailSize: DEFAULT_THUMBNAIL_SIZE,

      // Use virtualized viewport for rendering thumbnails
      useVirtualViewport: true,

      // Allow passing tokens to external client-side apps
      allowTokenPassing: false,

      // Maximum number of files in a page before eagerly loading metadata is disabled
      eagerLoadThreshold: 20000,

      // Override the default viewer for viewing a given mimetype
      fileTypeViewerOverride: new Map(),

      // Override the default viewer for previewing a given mimetype
      fileTypePreviewerOverride: new Map(),

      // Override the default renderer for a given mimetype
      fileTypeRendererOverride: new Map(),

      actions: {
        setNamespaceColor: (namespace: string, color: string) => {
          if (!color.match(/^#[0-9a-f]{6}$/i)) {
            console.error("Invalid color format. Must be a 6-digit hex code.");
            return;
          }

          set((state) => ({
            tagColors: {
              ...state.tagColors,
              namespaceColors: {
                ...state.tagColors.namespaceColors,
                [namespace]: color,
              },
            },
          }));
        },

        clearNamespaceColor: (namespace: string) => {
          set((state) => {
            const namespaceColors = { ...state.tagColors.namespaceColors };
            delete namespaceColors[namespace];
            return {
              tagColors: {
                ...state.tagColors,
                namespaceColors,
              },
            };
          });
        },

        setDefaultNamespacedColor: (color: string) => {
          if (!color.match(/^#[0-9a-f]{6}$/i)) {
            console.error("Invalid color format. Must be a 6-digit hex code.");
            return;
          }

          set((state) => ({
            tagColors: {
              ...state.tagColors,
              defaultNamespacedColor: color,
            },
          }));
        },

        setDefaultUnnamespacedColor: (color: string) => {
          if (!color.match(/^#[0-9a-f]{6}$/i)) {
            console.error("Invalid color format. Must be a 6-digit hex code.");
            return;
          }

          set((state) => ({
            tagColors: {
              ...state.tagColors,
              defaultUnnamespacedColor: color,
            },
          }));
        },

        resetNamespaceColors: () => {
          set((state) => ({
            tagColors: {
              ...state.tagColors,
              defaultNamespacedColor: DEFAULT_NAMESPACED_COLOR,
              defaultUnnamespacedColor: DEFAULT_UNNAMESPACED_COLOR,
              namespaceColors: { ...DEFAULT_TAG_COLORS },
            },
          }));
        },

        addAutopreviewFileType: (fileType: HydrusFileType) => {
          set((state) => {
            const autopreviewFileTypes = new Set(state.autopreviewFileTypes);
            autopreviewFileTypes.add(fileType);
            return {
              autopreviewFileTypes,
            };
          });
        },

        removeAutopreviewFileType: (fileType: HydrusFileType) => {
          set((state) => {
            const autopreviewFileTypes = new Set(state.autopreviewFileTypes);
            autopreviewFileTypes.delete(fileType);
            return {
              autopreviewFileTypes,
            };
          });
        },

        resetAutopreviewFileTypes: () => {
          set({
            autopreviewFileTypes: new Set(DEFAULT_AUTOPREVIEW_FILE_TYPES),
          });
        },

        setThumbnailSize: (size: number) => {
          set({
            thumbnailSize: size,
          });
        },

        setVirtualViewport: (enabled: boolean) => {
          set({
            useVirtualViewport: enabled,
          });
        },

        setAllowTokenPassing: (enabled: boolean) => {
          set({
            allowTokenPassing: enabled,
          });
        },

        setEagerLoadThreshold: (eagerLoadThreshold: number) => {
          set({
            eagerLoadThreshold,
          });
        },

        setFileTypeViewerOverride: (
          fileType: HydrusFileType,
          viewer: string,
        ) => {
          set((state) => {
            const fileTypeViewerOverride = new Map(
              state.fileTypeViewerOverride,
            );
            fileTypeViewerOverride.set(fileType, viewer);
            return { fileTypeViewerOverride };
          });
        },

        deleteFileTypeViewerOverride: (fileType: HydrusFileType) => {
          set((state) => {
            const fileTypeViewerOverride = new Map(
              state.fileTypeViewerOverride,
            );
            fileTypeViewerOverride.delete(fileType);
            return { fileTypeViewerOverride };
          });
        },

        clearFileTypeViewerOverrides: () => {
          set({ fileTypeViewerOverride: new Map() });
        },

        setFileTypePreviewerOverride: (
          fileType: HydrusFileType,
          viewer: string,
        ) => {
          set((state) => {
            const fileTypePreviewerOverride = new Map(
              state.fileTypePreviewerOverride,
            );
            fileTypePreviewerOverride.set(fileType, viewer);
            return { fileTypePreviewerOverride };
          });
        },

        deleteFileTypePreviewerOverride: (fileType: HydrusFileType) => {
          set((state) => {
            const fileTypePreviewerOverride = new Map(
              state.fileTypePreviewerOverride,
            );
            fileTypePreviewerOverride.delete(fileType);
            return { fileTypePreviewerOverride };
          });
        },

        clearFileTypePreviewerOverrides: () => {
          set({ fileTypePreviewerOverride: new Map() });
        },

        setFileTypeRendererOverride: (
          fileType: HydrusFileType,
          renderer: string,
        ) => {
          set((state) => {
            const fileTypeRendererOverride = new Map(
              state.fileTypeRendererOverride,
            );
            fileTypeRendererOverride.set(fileType, renderer);
            return { fileTypeRendererOverride };
          });
        },

        deleteFileTypeRendererOverride: (fileType: HydrusFileType) => {
          set((state) => {
            const fileTypeRendererOverride = new Map(
              state.fileTypeRendererOverride,
            );
            fileTypeRendererOverride.delete(fileType);
            return { fileTypeRendererOverride };
          });
        },

        clearFileTypeRendererOverrides: () => {
          set({ fileTypeRendererOverride: new Map() });
        },
      },
    }),
    {
      name: "hydrui-preferences",
      storage: jsonStorage,
      version: 1,
      partialize: (state) => ({
        tagColors: state.tagColors,
        autopreviewFileTypes: state.autopreviewFileTypes,
        thumbnailSize: state.thumbnailSize,
        useVirtualViewport: state.useVirtualViewport,
        allowTokenPassing: state.allowTokenPassing,
        eagerLoadThreshold: state.eagerLoadThreshold,
        fileTypeViewerOverride: state.fileTypeViewerOverride,
        fileTypePreviewerOverride: state.fileTypePreviewerOverride,
        fileTypeRendererOverride: state.fileTypeRendererOverride,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          // v0 used mimetypes. v1 moves to hydrus filetype enum.
          const stateV0 = persistedState as {
            autopreviewMimeTypes?: Set<string>;
            mimeTypeViewerOverride?: Map<string, string>;
            mimeTypePreviewerOverride?: Map<string, string>;
            mimeTypeRendererOverride?: Map<string, string>;
            autopreviewFileTypes?: Set<HydrusFileType>;
            fileTypeViewerOverride?: Map<HydrusFileType, string>;
            fileTypePreviewerOverride?: Map<HydrusFileType, string>;
            fileTypeRendererOverride?: Map<HydrusFileType, string>;
          };
          if (stateV0.autopreviewFileTypes === undefined) {
            stateV0.autopreviewFileTypes = new Set();
          }
          if (stateV0.fileTypeViewerOverride === undefined) {
            stateV0.fileTypeViewerOverride = new Map();
          }
          if (stateV0.fileTypePreviewerOverride === undefined) {
            stateV0.fileTypePreviewerOverride = new Map();
          }
          if (stateV0.fileTypeRendererOverride === undefined) {
            stateV0.fileTypeRendererOverride = new Map();
          }
          for (const previewMimeType of stateV0.autopreviewMimeTypes ??
            new Set()) {
            const fileType = filetypeFromMime(previewMimeType);
            stateV0.autopreviewFileTypes.add(fileType);
            switch (fileType) {
              case HydrusFileType.IMAGE_PNG:
                stateV0.autopreviewFileTypes.add(HydrusFileType.ANIMATION_APNG);
                break;
              case HydrusFileType.IMAGE_GIF:
                stateV0.autopreviewFileTypes.add(HydrusFileType.ANIMATION_GIF);
                break;
              case HydrusFileType.IMAGE_WEBP:
                stateV0.autopreviewFileTypes.add(HydrusFileType.ANIMATION_WEBP);
                break;
            }
          }
          for (const [mimetype, viewer] of stateV0.mimeTypeViewerOverride ??
            new Map()) {
            stateV0.fileTypeViewerOverride.set(
              filetypeFromMime(mimetype),
              viewer,
            );
          }
          for (const [mimetype, viewer] of stateV0.mimeTypePreviewerOverride ??
            new Map()) {
            stateV0.fileTypePreviewerOverride.set(
              filetypeFromMime(mimetype),
              viewer,
            );
          }
          for (const [mimetype, renderer] of stateV0.mimeTypeRendererOverride ??
            new Map()) {
            stateV0.fileTypeRendererOverride.set(
              filetypeFromMime(mimetype),
              renderer,
            );
          }
        }
        return persistedState;
      },
    },
  ),
);
