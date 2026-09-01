import { create } from "zustand";

export type SaveStatus = "saved" | "saving" | "failed" | "offline";
type SlashState = {
  blockId: string;
  query: string;
  x: number;
  y: number;
} | null;

type EditorState = {
  selectedBlockIds: string[];
  focusedBlockId: string | null;
  searchTargetBlockId: string | null;
  slashMenu: SlashState;
  saveStatus: SaveStatus;
  searchOpen: boolean;
  settingsOpen: boolean;
  trashOpen: boolean;
  commentsOpen: boolean;
  homeOpen: boolean;
  plannerOpen: boolean;
  theme: "dark" | "light";
  setSelectedBlocks: (ids: string[]) => void;
  setFocusedBlock: (id: string | null) => void;
  setSearchTargetBlock: (id: string | null) => void;
  setSlashMenu: (state: SlashState) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setTrashOpen: (open: boolean) => void;
  setCommentsOpen: (open: boolean) => void;
  setHomeOpen: (open: boolean) => void;
  setPlannerOpen: (open: boolean) => void;
  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedBlockIds: [],
  focusedBlockId: null,
  searchTargetBlockId: null,
  slashMenu: null,
  saveStatus: "saved",
  searchOpen: false,
  settingsOpen: false,
  trashOpen: false,
  commentsOpen: false,
  homeOpen: false,
  plannerOpen: false,
  theme: (localStorage.getItem("notes.theme") as "dark" | "light" | null) ?? "dark",
  setSelectedBlocks: (ids) => set({ selectedBlockIds: ids }),
  setFocusedBlock: (id) => set({ focusedBlockId: id }),
  setSearchTargetBlock: (id) => set({ searchTargetBlockId: id }),
  setSlashMenu: (state) => set({ slashMenu: state }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setTrashOpen: (open) => set({ trashOpen: open }),
  setCommentsOpen: (open) => set({ commentsOpen: open }),
  setHomeOpen: (open) => set((state) => ({ homeOpen: open, plannerOpen: open ? false : state.plannerOpen })),
  setPlannerOpen: (open) => set((state) => ({ plannerOpen: open, homeOpen: open ? false : state.homeOpen })),
  setTheme(theme) {
    localStorage.setItem("notes.theme", theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  toggleTheme() {
    const next = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  }
}));
