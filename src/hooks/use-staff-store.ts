import { toast } from "sonner";
import { create } from "zustand";
import type { User } from "@/db/schema";
import type { InsertUser } from "@/lib/validations/schema";
import { userService } from "@/services/user.service";

interface StaffState {
  staffs: User[];
  isLoading: boolean;
  fetchStaffs: () => Promise<void>;
  addStaff: (data: InsertUser) => Promise<void>;
  updateStaff: (id: string, data: Partial<InsertUser>) => Promise<void>;
  removeStaff: (id: string) => Promise<void>;
}

export const useStaffStore = create<StaffState>((set, get) => ({
  staffs: [],
  isLoading: false,

  fetchStaffs: async () => {
    set({ isLoading: true });
    try {
      // Bersihkan data hantu terlebih dahulu (nama/username kosong)
      await userService.cleanGhostData();
      const data = await userService.getAllStaff();
      set({ staffs: data as User[] });
    } catch (error) {
      console.error("Gagal mengambil data staff:", error);
      toast.error("Gagal memuat data staff");
    } finally {
      set({ isLoading: false });
    }
  },

  addStaff: async (data: InsertUser) => {
    try {
      const [newStaff] = await userService.createStaff(data);
      if (newStaff) {
        set((state) => ({
          staffs: [newStaff as User, ...state.staffs],
        }));
      }
    } catch (error) {
      console.error("Gagal menambah staff:", error);
      throw error; // Re-throw agar form bisa handle error (misal: USERNAME_EXISTS)
    }
  },

  updateStaff: async (id: string, data: Partial<InsertUser>) => {
    try {
      const [updatedStaff] = await userService.updateStaff(id, data);
      if (updatedStaff) {
        set((state) => ({
          staffs: state.staffs.map((s) =>
            s.id === id ? (updatedStaff as User) : s,
          ),
        }));
      }
    } catch (error) {
      console.error("Gagal update staff:", error);
      throw error;
    }
  },

  removeStaff: async (id: string) => {
    const previousStaffs = get().staffs;
    set((state) => ({
      staffs: state.staffs.filter((staff) => staff.id !== id),
    }));

    try {
      await userService.deleteStaff(id);
      toast.success("Staff berhasil dihapus");
    } catch (error) {
      console.error("Gagal menghapus staff:", error);
      toast.error("Gagal menghapus staff");
      set({ staffs: previousStaffs });
    }
  },
}));
