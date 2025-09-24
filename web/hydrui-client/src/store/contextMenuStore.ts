import { ReactNode } from "react";
import { create } from "zustand";

export interface MenuPosition {
  x: number;
  y: number;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  items?: MenuItem[];
  divider?: boolean;
}

export interface MenuBarMenu {
  label: string;
  items: MenuItem[];
}

interface ContextMenuState {
  isOpen: boolean;
  position: MenuPosition | null;
  items: MenuItem[];
  activeSubmenuPath: string[];

  actions: {
    openMenu: (position: MenuPosition, items: MenuItem[]) => void;
    closeMenu: () => void;
    setActiveSubmenuPath: (path: string[]) => void;
  };
}

export const useContextMenuActions = () =>
  useContextMenuStore((state) => state.actions);

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  position: null,
  items: [],
  activeSubmenuPath: [],

  actions: {
    openMenu: (position, items) =>
      set({
        isOpen: true,
        position,
        items,
        activeSubmenuPath: [],
      }),

    closeMenu: () =>
      set({
        isOpen: false,
        position: null,
        items: [],
        activeSubmenuPath: [],
      }),

    setActiveSubmenuPath: (path) =>
      set({
        activeSubmenuPath: path,
      }),
  },
}));
