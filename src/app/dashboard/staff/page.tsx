"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

// Internal Imports
import type { User } from "@/db/schema";
import { useStaffStore } from "@/hooks/use-staff-store";
import { cn } from "@/lib/utils";
import { type InsertUser, insertUserSchema } from "@/lib/validations/schema";

export default function StaffPage() {
  const { staffs, isLoading, fetchStaffs, removeStaff } = useStaffStore();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);

  const [sortKey, setSortKey] = useQueryState(
    "sortBy",
    parseAsString.withDefault("createdAt"),
  );
  const [sortOrder, setSortOrder] = useQueryState(
    "order",
    parseAsString.withDefault("desc"),
  );

  useEffect(() => {
    fetchStaffs();
  }, [fetchStaffs]);

  // Sort & Filter Logic
  const sortedAndFilteredStaffs = staffs
    .filter((staff) => {
      const name = staff.name?.toLowerCase() || "";
      const username = staff.username?.toLowerCase() || "";
      const query = search.toLowerCase();
      return name.includes(query) || username.includes(query);
    })
    .sort((a, b) => {
      const key = sortKey as keyof User;
      const aVal = a[key] ?? "";
      const bVal = b[key] ?? "";

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey)
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary" />
    );
  };

  // Helper Format Tanggal Aman
  const formatDateSafe = (
    dateVal: Date | number | string | null | undefined,
  ): string => {
    if (!dateVal) return "-";
    const date = new Date(dateVal);
    if (Number.isNaN(date.getTime())) return "-";
    return format(date, "d MMM yyyy", { locale: idLocale });
  };

  const handleEdit = (staff: User) => {
    setEditingStaff(staff);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        "Apakah Anda yakin ingin menghapus staff ini? Tindakan ini tidak bisa dibatalkan.",
      )
    ) {
      await removeStaff(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Staff & Kasir</h2>
          <p className="text-muted-foreground">
            Kelola akses pengguna dan peran kasir toko Anda.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingStaff(null);
            setIsDialogOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Staff
        </button>
      </div>

      {/* SEARCH */}
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Cari nama atau username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* TABLE */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sortedAndFilteredStaffs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <div className="rounded-full bg-muted p-3">
              <UserIcon className="h-6 w-6" />
            </div>
            <p>
              {search
                ? "Tidak ada staff yang cocok."
                : "Belum ada staff yang ditambahkan."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th
                    className="px-6 py-3 font-medium cursor-pointer hover:text-foreground transition-colors group"
                    onClick={() => toggleSort("name")}
                  >
                    <div className="flex items-center">
                      Nama
                      <SortIcon columnKey="name" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 font-medium cursor-pointer hover:text-foreground transition-colors group"
                    onClick={() => toggleSort("role")}
                  >
                    <div className="flex items-center">
                      Role
                      <SortIcon columnKey="role" />
                    </div>
                  </th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th
                    className="px-6 py-3 font-medium cursor-pointer hover:text-foreground transition-colors group"
                    onClick={() => toggleSort("createdAt")}
                  >
                    <div className="flex items-center">
                      Bergabung
                      <SortIcon columnKey="createdAt" />
                    </div>
                  </th>
                  <th className="px-6 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedAndFilteredStaffs.map((staff, index) => (
                  <tr
                    key={staff.id || `staff-${index}`}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {staff.name || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          @{staff.username || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border",
                          staff.role === "admin"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-blue-50 text-blue-700 border-blue-200",
                        )}
                      >
                        {staff.role === "admin" ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <UserIcon className="h-3 w-3" />
                        )}
                        {staff.role === "admin" ? "Administrator" : "Kasir"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        Aktif
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDateSafe(staff.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(staff)}
                          className="rounded-md p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(staff.id)}
                          className="rounded-md p-2 hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DIALOG FORM */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-xl bg-background shadow-lg border animate-in zoom-in-95 duration-200">
            <StaffForm
              initialData={editingStaff}
              onClose={() => setIsDialogOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENT: STAFF FORM ---
function StaffForm({
  initialData,
  onClose,
}: {
  initialData: User | null;
  onClose: () => void;
}) {
  const isEditMode = !!initialData;
  const { addStaff, updateStaff } = useStaffStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          username: initialData.username,
          password: initialData.password,
          role: initialData.role as "admin" | "cashier",
        }
      : {
          name: "",
          username: "",
          password: "",
          role: "cashier",
        },
  });

  const onSubmit = async (data: InsertUser) => {
    if (isSubmitting) return; // Prevent double submit
    setIsSubmitting(true);
    try {
      if (isEditMode && initialData) {
        await updateStaff(initialData.id, data);
        toast.success("Data staff berhasil diperbarui");
      } else {
        await addStaff(data);
        toast.success("Staff baru berhasil ditambahkan");
      }
      onClose();
    } catch (error: unknown) {
      const err = error as Error;
      // ✅ Tangkap Error Duplicate Username
      if (err.message === "USERNAME_EXISTS") {
        form.setError("username", {
          type: "manual",
          message: "Username ini sudah digunakan, pilih yang lain.",
        });
        // Fokuskan kursor ke field username
        form.setFocus("username");
      } else {
        console.error(err);
        toast.error("Terjadi kesalahan sistem");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h3 className="text-lg font-semibold">
          {isEditMode ? "Edit Data Staff" : "Tambah Staff Baru"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="name" className="text-sm font-medium">
              Nama Lengkap
            </label>
            <input
              id="name"
              {...form.register("name")}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Contoh: Budi Santoso"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-red-500">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <input
              id="username"
              {...form.register("username")}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="budis"
            />
            {form.formState.errors.username && (
              <p className="text-xs text-red-500">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password / PIN
            </label>
            <input
              id="password"
              type="password"
              {...form.register("password")}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="******"
            />
            {form.formState.errors.password && (
              <p className="text-xs text-red-500">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Peran (Role)</span>
            <div className="grid grid-cols-2 gap-4">
              <label
                className={cn(
                  "cursor-pointer rounded-lg border p-4 hover:bg-muted transition-all",
                  form.watch("role") === "cashier" &&
                    "border-primary bg-primary/5 ring-1 ring-primary",
                )}
              >
                <input
                  type="radio"
                  value="cashier"
                  {...form.register("role")}
                  className="sr-only"
                />
                <div className="flex items-center gap-2 mb-1">
                  <UserIcon className="h-4 w-4" />
                  <span className="font-medium">Kasir</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Akses terbatas untuk transaksi penjualan.
                </p>
              </label>

              <label
                className={cn(
                  "cursor-pointer rounded-lg border p-4 hover:bg-muted transition-all",
                  form.watch("role") === "admin" &&
                    "border-primary bg-primary/5 ring-1 ring-primary",
                )}
              >
                <input
                  type="radio"
                  value="admin"
                  {...form.register("role")}
                  className="sr-only"
                />
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Admin</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Akses penuh ke semua pengaturan & laporan.
                </p>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditMode ? "Simpan Perubahan" : "Buat Staff"}
          </button>
        </div>
      </form>
    </div>
  );
}
