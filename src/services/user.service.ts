import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { type InsertUser, insertUserSchema } from "@/lib/validations/schema";

/**
 * Helper: Cek apakah error mengandung pesan UNIQUE constraint pada username.
 * Diperlukan karena Drizzle bisa membungkus error dari proxy dengan format berbeda.
 */
function isUniqueUsernameError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error);
  return (
    (msg.includes("UNIQUE constraint failed") && msg.includes("username")) ||
    msg.includes("2067")
  );
}

export const userService = {
  // Ambil data staff aktif (hanya yang punya nama & username valid)
  getAllStaff: async () => {
    const db = getDb();
    return await db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          ne(users.name, ""),
          ne(users.username, ""),
        ),
      )
      .orderBy(sql`${users.createdAt} DESC`);
  },

  // Cek apakah username sudah dipakai (termasuk soft-deleted)
  isUsernameTaken: async (username: string, excludeId?: string) => {
    const db = getDb();
    const results = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username));

    if (excludeId) {
      return results.some((r) => r.id !== excludeId);
    }
    return results.length > 0;
  },

  // Tambah staff baru
  createStaff: async (data: InsertUser) => {
    const db = getDb();
    const validated = insertUserSchema.parse(data);

    // Pre-check: Cek username sebelum insert
    const taken = await userService.isUsernameTaken(validated.username);
    if (taken) {
      throw new Error("USERNAME_EXISTS");
    }

    try {
      return await db
        .insert(users)
        .values({
          ...validated,
          id: uuidv7(),
          version: 1,
          syncStatus: false,
        })
        .returning();
    } catch (error: unknown) {
      if (isUniqueUsernameError(error)) {
        throw new Error("USERNAME_EXISTS");
      }
      throw error;
    }
  },

  // Update staff
  updateStaff: async (id: string, data: Partial<InsertUser>) => {
    const db = getDb();

    if (data.username) {
      const taken = await userService.isUsernameTaken(data.username, id);
      if (taken) {
        throw new Error("USERNAME_EXISTS");
      }
    }

    try {
      return await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
          version: sql`version + 1`,
        })
        .where(eq(users.id, id))
        .returning();
    } catch (error: unknown) {
      if (isUniqueUsernameError(error)) {
        throw new Error("USERNAME_EXISTS");
      }
      throw error;
    }
  },

  // Soft delete
  deleteStaff: async (id: string) => {
    const db = getDb();
    return await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, id));
  },

  // Hard delete: Bersihkan data "hantu" (nama/username kosong) & data test lama
  cleanGhostData: async () => {
    const db = getDb();
    // Hapus baris tanpa nama
    await db.delete(users).where(eq(users.name, ""));
    // Hapus baris tanpa username
    await db.delete(users).where(eq(users.username, ""));
  },
};
