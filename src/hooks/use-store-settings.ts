import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useTransition } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	type StoreProfileValues,
	storeProfileSchema,
} from "@/lib/validations/settings";
import { StoreService } from "@/services/store.service";

export function useStoreSettings() {
	const [isPending, startTransition] = useTransition();
	const [isLoading, setIsLoading] = useState(true);

	const form = useForm<StoreProfileValues>({
		resolver: zodResolver(storeProfileSchema),
		defaultValues: {
			name: "",
			address: "",
			phone: "",
			email: "",
			currency: "IDR",
		},
	});

	useEffect(() => {
		async function loadSettings() {
			try {
				const settings = await StoreService.getSettings();
				if (settings) {
					form.reset({
						name: settings.name ?? "",
						address: settings.address ?? "",
						phone: settings.phone ?? "",
						email: settings.email ?? "",
						currency: settings.currency ?? "IDR",
					});
				}
			} catch (error) {
				console.error("Failed to load store settings", error);
				toast.error("Gagal mengambil data toko");
			} finally {
				setIsLoading(false);
			}
		}
		loadSettings();
	}, [form]);

	const onSubmit: SubmitHandler<StoreProfileValues> = async (values) => {
		startTransition(async () => {
			try {
				const result = await StoreService.updateSettings(values);
				if (result.success) {
					toast.success("Profil toko berhasil diperbarui");
				} else {
					toast.error(result.error || "Gagal memperbarui profil toko");
				}
			} catch (error) {
				console.error("Update error:", error);
				toast.error("Terjadi kesalahan sistem saat menyimpan");
			}
		});
	};

	return {
		form,
		isLoading,
		isPending,
		onSubmit: form.handleSubmit(onSubmit),
	};
}
