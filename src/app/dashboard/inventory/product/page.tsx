"use client";

import {
  AlertCircle,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ProductForm } from "@/components/inventory/product-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// 🔗 Hooks & Store
import {
  useCategories,
  useProductMutations,
  useProducts,
} from "@/hooks/use-products";
import { useSessionStore } from "@/hooks/use-session-store";
import type { ProductSelect } from "@/services/product.service";

export default function ProductPage() {
  // 1. Global State
  const { branchId, userId } = useSessionStore();

  // 2. Local State
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSelect | null>(
    null,
  );

  // State untuk Delete Dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 3. Data Fetching (TanStack Query)
  const {
    data: productsData,
    isLoading,
    isError,
  } = useProducts({
    branchId: branchId || "",
    query: searchQuery,
    page: page,
    limit: 10,
  });

  const { data: categories } = useCategories(branchId || "");
  const { deleteProduct } = useProductMutations(branchId || "");

  // 4. Memoized Helpers
  // Membuat Map Kategori untuk akses O(1) di tabel
  const categoryMap = useMemo(() => {
    // Menggunakan konstruktor Map langsung lebih "clean" dan performant
    if (!categories) return new Map<string, string>();

    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  // Formatter Rupiah
  const formatCurrency = (val: string) => {
    const num = parseFloat(val);
    return Number.isNaN(num)
      ? "Rp 0"
      : Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
        }).format(num);
  };

  // 5. Handlers
  const handleEdit = (product: ProductSelect) => {
    setSelectedProduct(product);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedProduct(null); // Reset untuk mode create
    setIsFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId || !userId) return;
    try {
      await deleteProduct.mutateAsync({ productId: deleteId, userId });
      setDeleteId(null);
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  // 6. Loading & Error States Guard
  if (!branchId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        <LoaderSpinner />
        <span className="ml-2">Memuat sesi pengguna...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 p-8 max-w-[1600px] mx-auto">
      {/* 🟢 HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Produk
          </h1>
          <p className="text-muted-foreground mt-1">
            Kelola katalog produk, harga, dan spesifikasi inventaris cabang ini.
          </p>
        </div>
        <Button onClick={handleCreate} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          Tambah Produk
        </Button>
      </div>

      {/* 🟠 TOOLBAR (Search & Filter) */}
      <div className="flex items-center space-x-2 bg-white p-1 rounded-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, SKU, atau barcode..."
            className="pl-9 bg-gray-50 border-gray-200 focus-visible:ring-blue-500"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1); // Reset ke halaman 1 saat search
            }}
          />
        </div>
        <Button variant="outline" size="icon" className="border-dashed">
          <Filter className="h-4 w-4 text-gray-600" />
        </Button>
      </div>

      {/* 🔵 DATA TABLE */}
      <div className="rounded-lg border bg-white shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-[120px]">SKU / Kode</TableHead>
                <TableHead className="min-w-[250px]">
                  Informasi Produk
                </TableHead>
                <TableHead className="w-[150px]">Kategori</TableHead>
                <TableHead className="text-right w-[140px]">
                  Harga Jual
                </TableHead>
                <TableHead className="text-center w-[120px]">
                  Min. Stok
                </TableHead>
                <TableHead className="text-center w-[100px]">Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // ✨ Skeleton Loading dengan Key yang aman bagi linter
                ["s1", "s2", "s3", "s4", "s5"].map((id) => (
                  <TableRow key={id}>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20 ml-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8 mx-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-red-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-6 w-6" />
                      <p>Gagal memuat data produk.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                      >
                        Coba Lagi
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : productsData?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Search className="h-8 w-8 opacity-20" />
                      <p>Tidak ada produk ditemukan.</p>
                      {searchQuery && (
                        <Button
                          variant="link"
                          onClick={() => setSearchQuery("")}
                        >
                          Bersihkan pencarian
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                // 📦 Real Data Rendering
                productsData?.data?.map((product) => (
                  <TableRow
                    key={product.id}
                    className="group hover:bg-gray-50/50 transition-colors"
                  >
                    {/* SKU & Barcode */}
                    <TableCell className="align-top py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded w-fit">
                          {product.sku}
                        </span>
                        {product.barcode && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="i-lucide-scan-barcode w-3 h-3" />{" "}
                            {product.barcode}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Nama & Deskripsi */}
                    <TableCell className="align-top py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                          {product.name}
                        </span>
                        {product.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {product.description}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Kategori */}
                    <TableCell className="align-top py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                        {product.categoryId
                          ? categoryMap.get(product.categoryId) ||
                            "Uncategorized"
                          : "—"}
                      </span>
                    </TableCell>

                    {/* Harga */}
                    <TableCell className="text-right align-top py-4 font-mono text-sm text-gray-900">
                      {formatCurrency(product.price)}
                    </TableCell>

                    {/* Min Stok (Stok Realtime tidak ada di tabel products) */}
                    <TableCell className="text-center align-top py-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded cursor-help">
                              Min: {product.minimumStock ?? 0}{" "}
                              {product.unit ?? "pcs"}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Stok minimum (Reorder point).</p>
                            <p className="text-[10px] text-gray-400">
                              Stok fisik ada di menu Inventory.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center align-top py-4">
                      <Badge
                        variant={product.isActive ? "default" : "secondary"}
                        className={
                          product.isActive
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-gray-300 text-gray-600 hover:bg-gray-400"
                        }
                      >
                        {product.isActive ? "Aktif" : "Non-Aktif"}
                      </Badge>
                    </TableCell>

                    {/* Actions Menu */}
                    <TableCell className="align-top py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEdit(product)}>
                            <Pencil className="mr-2 h-4 w-4 text-blue-500" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteId(product.id)}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 🟣 PAGINATION FOOTER */}
        <div className="border-t bg-gray-50 px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Menampilkan <strong>{productsData?.data?.length || 0}</strong> dari{" "}
            <strong>{productsData?.meta?.total || 0}</strong> produk
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              Sebelumnya
            </Button>
            <div className="text-xs font-medium w-8 text-center">{page}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={
                !productsData ||
                page >= (productsData.meta?.totalPages || 1) ||
                isLoading
              }
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      </div>

      {/* 📝 FORM DIALOG */}
      {branchId && (
        <ProductForm
          branchId={branchId}
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          initialData={selectedProduct}
          categories={categories || []}
        />
      )}

      {/* 🗑️ DELETE ALERT DIALOG */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan mengarsipkan produk ini (Soft Delete). Data
              historis penjualan akan tetap aman, namun produk tidak bisa
              dipilih untuk transaksi baru.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Ya, Hapus Produk
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper Simple Spinner
function LoaderSpinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
  );
}
