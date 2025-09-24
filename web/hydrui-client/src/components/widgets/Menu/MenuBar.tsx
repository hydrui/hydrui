import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  MenuBarMenu,
  MenuItem,
  useContextMenuStore,
} from "@/store/contextMenuStore";

import MenuList from "./MenuList";
import "./index.css";

interface MenuBarItemProps {
  label: string;
  items: MenuItem[];
  isOpen: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}

const MenuBarItem: React.FC<MenuBarItemProps> = ({
  label,
  items,
  isOpen,
  onMouseEnter,
  onClick,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({
    position: "fixed",
    opacity: 0,
  });
  const [wasOpenedByKeyboard, setWasOpenedByKeyboard] = useState(false);
  const [activeSubmenuPath, setActiveSubmenuPath] = useState<string[]>([]);

  // Calculate menu position when opened
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const { innerHeight } = window;

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        top: rect.bottom,
        opacity: 1,
        maxHeight: `${innerHeight - rect.bottom}px`,
      });
    }

    if (!isOpen) {
      setActiveSubmenuPath([]);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown"
      ) {
        setWasOpenedByKeyboard(true);
        onClick();
      }
    },
    [onClick],
  );

  const handleClick = useCallback(() => {
    setWasOpenedByKeyboard(false);
    onClick();
  }, [onClick]);

  return (
    <div
      ref={menuRef}
      className={`menu-bar-item ${isOpen ? "active" : ""}`}
      onMouseEnter={onMouseEnter}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {label}
      {isOpen && (
        <div className="submenu visible" style={menuStyle}>
          <MenuList
            items={items}
            level={0}
            parentPath={[]}
            activeSubmenuPath={activeSubmenuPath}
            setActiveSubmenuPath={setActiveSubmenuPath}
            wasOpenedByKeyboard={wasOpenedByKeyboard}
          />
        </div>
      )}
    </div>
  );
};

interface MenuBarProps {
  menus: MenuBarMenu[];
}

const MenuBar: React.FC<MenuBarProps> = ({ menus }) => {
  const {
    isOpen: isContextMenuOpen,
    actions: { closeMenu },
  } = useContextMenuStore();
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenu !== null) {
        const target = event.target as HTMLElement;
        if (!target.closest(".menu-bar")) {
          setActiveMenu(null);
        }
      }
    };

    if (activeMenu !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMenu]);

  // Close menu when context menu opens
  useEffect(() => {
    if (isContextMenuOpen) {
      setActiveMenu(null);
    }
  }, [isContextMenuOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeMenu === null) return;

      const calcPrevMenu = (prev: number | null) =>
        prev === null || prev === 0 ? menus.length - 1 : prev - 1;
      const calcNextMenu = (next: number | null) =>
        next === null ? 0 : (next + 1) % menus.length;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          setActiveMenu(null);
          break;
        case "ArrowLeft":
          event.preventDefault();
          setActiveMenu(calcPrevMenu);
          break;
        case "ArrowRight":
          event.preventDefault();
          setActiveMenu(calcNextMenu);
          break;
        case "ArrowDown":
          // Let the MenuList handle this
          event.preventDefault();
          break;
      }
    };

    if (activeMenu !== null) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenu, menus.length]);

  const handleMenuClick = useCallback(
    (index: number) => {
      // Toggle menu when clicking
      setActiveMenu(activeMenu === index ? null : index);
      // Close any open context menu
      if (isContextMenuOpen) {
        closeMenu();
      }
    },
    [activeMenu, isContextMenuOpen, closeMenu],
  );

  const handleMenuHover = useCallback(
    (index: number) => {
      // Only switch menus if one is already open
      if (activeMenu !== null) {
        setActiveMenu(index);
      }
    },
    [activeMenu, setActiveMenu],
  );

  return (
    <div className="menu-bar">
      {menus.map((menu, index) => (
        <MenuBarItem
          data-menu-item={index}
          key={menu.label}
          label={menu.label}
          items={menu.items}
          isOpen={activeMenu === index}
          onMouseEnter={() => handleMenuHover(index)}
          onClick={() => handleMenuClick(index)}
        />
      ))}
    </div>
  );
};

export default MenuBar;
