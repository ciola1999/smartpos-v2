import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SessionState {
  // State
  branchId: string | null;
  warehouseId: string | null;
  userId: string | null;
  userName: string | null;

  // Actions
  setBranchId: (id: string) => void;
  setWarehouseId: (id: string) => void;
  setUser: (id: string, name: string) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      branchId: null,
      warehouseId: null,
      userId: "user-system-default", // Default user untuk dev awal
      userName: "Super Admin",

      setBranchId: (id) => set({ branchId: id }),
      setWarehouseId: (id) => set({ warehouseId: id }),
      setUser: (id, name) => set({ userId: id, userName: name }),

      logout: () =>
        set({
          branchId: null,
          warehouseId: null,
          userId: null,
          userName: null,
        }),
    }),
    {
      name: "smartpos-session", // Key di LocalStorage
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
