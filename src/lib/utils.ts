import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Menggabungkan class Tailwind dengan aman (mengatasi konflik style).
 * Wajib digunakan untuk semua komponen UI.
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// 👇 Tambahkan fungsi ini
export function isTauri(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof window.__TAURI_INTERNALS__ !== "undefined"
	);
}
