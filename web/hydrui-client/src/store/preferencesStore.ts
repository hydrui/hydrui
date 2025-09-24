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

const DEFAULT_NAMESPACED_COLOR = "#72a0c1";
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
  thumbnailSize: number;
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
      },
    }),
    {
      name: "hydrui-preferences",
      storage: jsonStorage,
      partialize: (state) => ({
        tagColors: state.tagColors,
        autopreviewMimeTypes: state.autopreviewMimeTypes,
        thumbnailSize: state.thumbnailSize,
      }),
    },
  ),
);
