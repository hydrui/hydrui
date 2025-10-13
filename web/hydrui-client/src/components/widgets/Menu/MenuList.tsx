import { ChevronRightIcon } from "@heroicons/react/24/solid";
import React, {
  CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { MenuItem, useContextMenuStore } from "@/store/contextMenuStore";

import "./index.css";

interface MenuListProps {
  items: MenuItem[];
  level: number;
  parentPath: string[];
  activeSubmenuPath?: string[];
  setActiveSubmenuPath?: (path: string[]) => void;
  wasOpenedByKeyboard?: boolean;
}

const SUBMENU_OPEN_DELAY = 200;
const SUBMENU_CLOSE_DELAY = 300;

const MenuList: React.FC<MenuListProps> = ({
  items,
  level,
  parentPath,
  activeSubmenuPath = [],
  setActiveSubmenuPath = () => {},
  wasOpenedByKeyboard = false,
}) => {
  const {
    actions: { closeMenu },
  } = useContextMenuStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [usedKeyboardNavigation, setUsedKeyboardNavigation] = useState(false);
  const [submenuPositions, setSubmenuPositions] = useState<
    Record<string, CSSProperties>
  >({});
  const openTimerRef = useRef<number | undefined>(undefined);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const submenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
      }
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Set initial selection when submenu opens
  useEffect(() => {
    const isActive =
      level === activeSubmenuPath.length ||
      (level < activeSubmenuPath.length &&
        activeSubmenuPath[level] === parentPath[parentPath.length - 1]);

    if (isActive) {
      // Only auto-select first item if opened by keyboard
      if (
        level > 0 &&
        level === activeSubmenuPath.length &&
        wasOpenedByKeyboard
      ) {
        const firstItem = items.find((item) => !item.divider);
        if (firstItem) {
          setHoveredItem(firstItem.id);
        }
      }
      menuRef.current?.focus();
    }
  }, [level, activeSubmenuPath, parentPath, items, wasOpenedByKeyboard]);

  // Handle keyboard navigation and focus trapping
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!menuRef.current) return;

      const visibleItems = items.filter((item) => !item.divider);
      const currentIndex = hoveredItem
        ? visibleItems.findIndex((item) => item.id === hoveredItem)
        : -1;
      let nextIndex = currentIndex;

      switch (event.key) {
        case "Tab":
          // Prevent tabbing out of the menu
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) {
            // Tab backwards
            nextIndex =
              currentIndex === -1
                ? visibleItems.length - 1
                : (currentIndex - 1 + visibleItems.length) %
                  visibleItems.length;
          } else {
            // Tab forwards
            nextIndex =
              currentIndex === -1
                ? 0
                : (currentIndex + 1) % visibleItems.length;
          }
          break;
        case "ArrowDown":
          event.preventDefault();
          event.stopPropagation();
          nextIndex =
            currentIndex === -1 ? 0 : (currentIndex + 1) % visibleItems.length;
          break;
        case "ArrowUp":
          event.preventDefault();
          event.stopPropagation();
          nextIndex =
            currentIndex === -1
              ? visibleItems.length - 1
              : (currentIndex - 1 + visibleItems.length) % visibleItems.length;
          break;
        case "ArrowRight":
          event.preventDefault();
          if (hoveredItem) {
            const currentItem = visibleItems.find(
              (item) => item.id === hoveredItem,
            );
            if (currentItem?.items && !currentItem.disabled) {
              const newPath = [...parentPath, hoveredItem];
              setUsedKeyboardNavigation(true);
              setActiveSubmenuPath(newPath);
              event.stopPropagation();
            }
          }
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (level > 0) {
            const parentMenuPath = parentPath.slice(0, -1);
            setActiveSubmenuPath(parentMenuPath);
            event.stopPropagation();
          }
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (hoveredItem) {
            const currentItem = visibleItems.find(
              (item) => item.id === hoveredItem,
            );
            if (
              currentItem?.onClick &&
              !currentItem.disabled &&
              !currentItem.items
            ) {
              currentItem.onClick();
            }
            closeMenu();
          }
          break;
        default:
          return;
      }

      if (nextIndex !== currentIndex) {
        const nextItem = visibleItems[nextIndex];
        if (nextItem) {
          setHoveredItem(nextItem.id);
        }
      }
    };

    // Only attach keyboard handlers to the active menu level
    const isActive =
      level === activeSubmenuPath.length ||
      (level < activeSubmenuPath.length &&
        activeSubmenuPath[level] === parentPath[parentPath.length - 1]);

    if (isActive) {
      const menu = menuRef.current;
      menu?.addEventListener("keydown", handleKeyDown);
      return () => menu?.removeEventListener("keydown", handleKeyDown);
    }

    return;
  }, [
    items,
    hoveredItem,
    level,
    parentPath,
    activeSubmenuPath,
    setActiveSubmenuPath,
    closeMenu,
  ]);

  const handleMouseEnter = (item: MenuItem) => {
    setHoveredItem(item.id);
    setUsedKeyboardNavigation(false);

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }

    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = undefined;
    }

    if (item.items && !item.disabled) {
      openTimerRef.current = window.setTimeout(() => {
        setActiveSubmenuPath([...parentPath, item.id]);
      }, SUBMENU_OPEN_DELAY);
    } else {
      // If hovering over a non-submenu item, close any open submenu at this level after a delay
      closeTimerRef.current = window.setTimeout(() => {
        setActiveSubmenuPath(parentPath);
      }, SUBMENU_CLOSE_DELAY);
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);

    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = undefined;
    }

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }

    closeTimerRef.current = window.setTimeout(() => {
      setActiveSubmenuPath(parentPath);
    }, SUBMENU_CLOSE_DELAY);
  };

  const isSubmenuOpen = useCallback(
    (itemId: string) => {
      const path = [...parentPath, itemId];
      return path.every((id, index) => activeSubmenuPath[index] === id);
    },
    [activeSubmenuPath, parentPath],
  );

  // Update submenu positions after render
  useLayoutEffect(() => {
    const openSubmenus = items
      .filter((item) => item.items && isSubmenuOpen(item.id))
      .map((item) => item.id);

    if (openSubmenus.length === 0) return;

    const newPositions: Record<string, CSSProperties> = {};

    for (const itemId of openSubmenus) {
      const submenu = submenuRefs.current[itemId];
      const menuItem = submenu?.parentElement;
      if (!submenu || !menuItem) continue;

      const menuRect = menuItem.getBoundingClientRect();
      const submenuRect = submenu.getBoundingClientRect();
      const { innerWidth, innerHeight } = window;

      let left = menuRect.right;
      let top = menuRect.top - 5;

      // If submenu would go off right edge, show it to the left instead
      if (left + submenuRect.width > innerWidth) {
        left = Math.max(0, menuRect.left - submenuRect.width);
      }

      // Adjust vertical position if needed
      if (top + submenuRect.height > innerHeight) {
        top = Math.max(0, innerHeight - submenuRect.height);
      }

      newPositions[itemId] = {
        position: "fixed" as const,
        left,
        top,
        opacity: 1,
      };
    }

    setSubmenuPositions(newPositions);
  }, [items, activeSubmenuPath, parentPath, isSubmenuOpen]);

  return (
    <div
      ref={menuRef}
      className="menu-list"
      role="menu"
      aria-orientation="vertical"
      tabIndex={0}
    >
      {items.map((item) => {
        if (item.divider) {
          return (
            <div key={item.id} className="menu-divider" role="separator" />
          );
        }

        const isOpen = isSubmenuOpen(item.id);
        const itemPath = [...parentPath, item.id];
        const isActive = hoveredItem === item.id;

        return (
          <div
            key={item.id}
            className={`menu-item ${isActive ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
            role="menuitem"
            aria-haspopup={!!item.items}
            aria-expanded={item.items ? isOpen : undefined}
            onClick={() => {
              if (item.disabled) {
                return;
              }
              if (item.items) {
                setActiveSubmenuPath([...parentPath, item.id]);
              } else if (item.onClick) {
                item.onClick();
                closeMenu();
              }
            }}
            onMouseEnter={() => handleMouseEnter(item)}
            onMouseLeave={() => handleMouseLeave()}
          >
            {item.icon && <span className="menu-icon">{item.icon}</span>}
            <span className="menu-label">{item.label}</span>
            {item.items && <ChevronRightIcon className="menu-chevron" />}

            {/* Submenu */}
            {item.items && isOpen && (
              <div
                ref={(el) => {
                  submenuRefs.current[item.id] = el;
                }}
                className="submenu visible"
                style={{
                  ...submenuPositions[item.id],
                  zIndex: 50 + level,
                }}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => handleMouseLeave()}
              >
                <MenuList
                  items={item.items}
                  level={level + 1}
                  parentPath={itemPath}
                  activeSubmenuPath={activeSubmenuPath}
                  setActiveSubmenuPath={setActiveSubmenuPath}
                  wasOpenedByKeyboard={usedKeyboardNavigation}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MenuList;
