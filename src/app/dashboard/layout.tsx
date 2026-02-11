import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		// Container Utama: Full Screen & Tidak ada scroll di body browser
		<div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
			{/* Kiri: Sidebar Smart */}
			{/* Lebar otomatis diatur oleh komponen Sidebar (Motion) */}
			<Sidebar />

			{/* Kanan: Main Content Area */}
			<div className="flex flex-1 flex-col overflow-hidden relative">
				{/* Atas: Header Control Center */}
				<Header />

				{/* Tengah: Content yang bisa di-scroll */}
				<main className="flex-1 overflow-y-auto bg-muted/5 p-4 sm:p-6 scroll-smooth">
					{/* Wrapper untuk membatasi lebar konten agar nyaman dibaca di layar ultrawide */}
					<div className="mx-auto max-w-[1600px] h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}
