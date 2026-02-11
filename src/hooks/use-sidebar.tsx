"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// 1. Definisi State yang Strict
interface SidebarState {
	isOpen: boolean;
	isMobile: boolean; // Auto-detect mobile
	toggle: () => void;
	setOpen: (value: boolean) => void;
	setMobile: (value: boolean) => void;
}

// 2. Pembuatan Store dengan Persistence (localStorage)
export const useSidebar = create<SidebarState>()(
	persist(
		(set) => ({
			isOpen: true, // Default: Terbuka
			isMobile: false,

			// Action: Toggle (Buka/Tutup)
			toggle: () => set((state) => ({ isOpen: !state.isOpen })),

			// Action: Set Explicit (Misal: Force Close saat pindah halaman di mobile)
			setOpen: (value) => set({ isOpen: value }),

			// Action: Set Mobile State (Responsive Handler)
			setMobile: (value) => set({ isMobile: value }),
		}),
		{
			name: "smartpos-sidebar-storage", // Key unik di localStorage
			storage: createJSONStorage(() => localStorage), // Explicit storage
			// Kita skip 'isMobile' dari storage supaya selalu fresh detect saat load
			partialize: (state) => ({ isOpen: state.isOpen }),
		},
	),
);
