import { create } from "zustand";
import { persist } from "zustand/middleware";

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

const DEFAULT_AUTOPREVIEW_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
];

const DEFAULT_THUMBNAIL_SIZE = 100;

interface TagColorPreferences {
  namespaceColors: Record<string, string>;
  defaultNamespacedColor: string;
  defaultUnnamespacedColor: string;
}

interface PreferencesState {
  tagColors: TagColorPreferences;
  autopreviewMimeTypes: Set<string>;
  mimeTypeViewerOverride: Map<string, string>;
  mimeTypePreviewerOverride: Map<string, string>;
  mimeTypeRendererOverride: Map<string, string>;
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
    addAutopreviewMimeType: (mimeType: string) => void;
    removeAutopreviewMimeType: (mimeType: string) => void;
    resetAutopreviewMimeTypes: () => void;
    setThumbnailSize: (size: number) => void;
    setVirtualViewport: (enabled: boolean) => void;
    setAllowTokenPassing: (enabled: boolean) => void;
    setEagerLoadThreshold: (eagerLoadThreshold: number) => void;
    setMimeTypeViewerOverride: (mimeType: string, viewer: string) => void;
    deleteMimeTypeViewerOverride: (mimeType: string) => void;
    clearMimeTypeViewerOverrides: () => void;
    setMimeTypePreviewerOverride: (mimeType: string, viewer: string) => void;
    deleteMimeTypePreviewerOverride: (mimeType: string) => void;
    clearMimeTypePreviewerOverrides: () => void;
    setMimeTypeRendererOverride: (mimeType: string, renderer: string) => void;
    deleteMimeTypeRendererOverride: (mimeType: string) => void;
    clearMimeTypeRendererOverrides: () => void;
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
      autopreviewMimeTypes: new Set(DEFAULT_AUTOPREVIEW_MIME_TYPES),

      // Thumbnail size to use in page views
      thumbnailSize: DEFAULT_THUMBNAIL_SIZE,

      // Use virtualized viewport for rendering thumbnails
      useVirtualViewport: true,

      // Allow passing tokens to external client-side apps
      allowTokenPassing: false,

      // Maximum number of files in a page before eagerly loading metadata is disabled
      eagerLoadThreshold: 20000,

      // Override the default viewer for viewing a given mimetype
      mimeTypeViewerOverride: new Map(),

      // Override the default viewer for previewing a given mimetype
      mimeTypePreviewerOverride: new Map(),

      // Override the default renderer for a given mimetype
      mimeTypeRendererOverride: new Map(),

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

        addAutopreviewMimeType: (mimeType: string) => {
          set((state) => {
            const newAutopreviewMimeTypes = new Set(state.autopreviewMimeTypes);
            newAutopreviewMimeTypes.add(mimeType);
            return {
              autopreviewMimeTypes: newAutopreviewMimeTypes,
            };
          });
        },

        removeAutopreviewMimeType: (mimeType: string) => {
          set((state) => {
            const newAutopreviewMimeTypes = new Set(state.autopreviewMimeTypes);
            newAutopreviewMimeTypes.delete(mimeType);
            return {
              autopreviewMimeTypes: newAutopreviewMimeTypes,
            };
          });
        },

        resetAutopreviewMimeTypes: () => {
          set({
            autopreviewMimeTypes: new Set(DEFAULT_AUTOPREVIEW_MIME_TYPES),
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

        setMimeTypeViewerOverride: (mimeType: string, viewer: string) => {
          set((state) => {
            const mimeTypeViewerOverride = new Map(
              state.mimeTypeViewerOverride,
            );
            mimeTypeViewerOverride.set(mimeType, viewer);
            return { mimeTypeViewerOverride };
          });
        },

        deleteMimeTypeViewerOverride: (mimeType: string) => {
          set((state) => {
            const mimeTypeViewerOverride = new Map(
              state.mimeTypeViewerOverride,
            );
            mimeTypeViewerOverride.delete(mimeType);
            return { mimeTypeViewerOverride };
          });
        },

        clearMimeTypeViewerOverrides: () => {
          set({ mimeTypeViewerOverride: new Map() });
        },

        setMimeTypePreviewerOverride: (mimeType: string, viewer: string) => {
          set((state) => {
            const mimeTypePreviewerOverride = new Map(
              state.mimeTypePreviewerOverride,
            );
            mimeTypePreviewerOverride.set(mimeType, viewer);
            return { mimeTypePreviewerOverride };
          });
        },

        deleteMimeTypePreviewerOverride: (mimeType: string) => {
          set((state) => {
            const mimeTypePreviewerOverride = new Map(
              state.mimeTypePreviewerOverride,
            );
            mimeTypePreviewerOverride.delete(mimeType);
            return { mimeTypePreviewerOverride };
          });
        },

        clearMimeTypePreviewerOverrides: () => {
          set({ mimeTypePreviewerOverride: new Map() });
        },

        setMimeTypeRendererOverride: (mimeType: string, renderer: string) => {
          set((state) => {
            const mimeTypeRendererOverride = new Map(
              state.mimeTypeRendererOverride,
            );
            mimeTypeRendererOverride.set(mimeType, renderer);
            return { mimeTypeRendererOverride };
          });
        },

        deleteMimeTypeRendererOverride: (mimeType: string) => {
          set((state) => {
            const mimeTypeRendererOverride = new Map(
              state.mimeTypeRendererOverride,
            );
            mimeTypeRendererOverride.delete(mimeType);
            return { mimeTypeRendererOverride };
          });
        },

        clearMimeTypeRendererOverrides: () => {
          set({ mimeTypeRendererOverride: new Map() });
        },
      },
    }),
    {
      name: "hydrui-preferences",
      storage: jsonStorage,
      partialize: (state) => ({
        tagColors: state.tagColors,
        autopreviewMimeTypes: state.autopreviewMimeTypes,
        thumbnailSize: state.thumbnailSize,
        useVirtualViewport: state.useVirtualViewport,
        allowTokenPassing: state.allowTokenPassing,
        eagerLoadThreshold: state.eagerLoadThreshold,
        mimeTypeViewerOverride: state.mimeTypeViewerOverride,
        mimeTypePreviewerOverride: state.mimeTypePreviewerOverride,
        mimeTypeRendererOverride: state.mimeTypeRendererOverride,
      }),
    },
  ),
);
