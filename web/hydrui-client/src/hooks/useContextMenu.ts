import { useCallback } from "react";

import { MenuItem, useContextMenuStore } from "../store/contextMenuStore";

export const useContextMenu = () => {
  const {
    actions: { openMenu, closeMenu },
  } = useContextMenuStore();

  const showContextMenu = useCallback(
    (event: React.MouseEvent, items: MenuItem[]) => {
      event.preventDefault();
      openMenu({ x: event.clientX, y: event.clientY }, items);
    },
    [openMenu],
  );

  return {
    showContextMenu,
    closeContextMenu: closeMenu,
  };
};
