import { useEffect } from "react";

import { useEditorStore } from "../store/editorStore";

type KeyboardActions = {
  save: () => void;
};

export function useEditorKeyboard({ save }: KeyboardActions) {
  const setSearchOpen = useEditorStore((state) => state.setSearchOpen);
  const toggleTheme = useEditorStore((state) => state.toggleTheme);
  const setSlashMenu = useEditorStore((state) => state.setSlashMenu);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "p" || (event.shiftKey && key === "f")) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.shiftKey && key === "l") {
        event.preventDefault();
        toggleTheme();
      }
      if (key === "s") {
        event.preventDefault();
        save();
      }
      if (key === "/") {
        event.preventDefault();
        setSlashMenu(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save, setSearchOpen, setSlashMenu, toggleTheme]);
}
