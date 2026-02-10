"use client";

import { cn } from "@/lib/utils";
import {
	LayoutDashboard,
	LogOut,
	Package,
	Settings,
	ShoppingCart,
	Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Definisikan tipe untuk item navigasi
interface SidebarItem {
	title: string;
	href: string;
	icon: React.ElementType;
}

const sidebarItems: SidebarItem[] = [
	{ title: "Dashboard", href: "/", icon: LayoutDashboard },
	{ title: "Kasir (POS)", href: "/pos", icon: ShoppingCart },
	{ title: "Produk", href: "/products", icon: Package },
	{ title: "Pengaturan", href: "/settings", icon: Settings },
];

export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:flex">
			{/* Header Logo */}
			<div className="flex h-16 items-center border-b border-border/40 px-6">
				<Link
					href="/"
					className="flex items-center gap-2 font-bold text-xl tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<Store className="h-5 w-5" />
					</div>
					<span>SmartPOS</span>
				</Link>
			</div>

			{/* Navigation */}
			<nav className="flex-1 overflow-y-auto py-4">
				<ul className="grid gap-1 px-2">
					{sidebarItems.map((item) => {
						const isActive = pathname === item.href;
						return (
							<li key={item.href}>
								<Link
									href={item.href}
									className={cn(
										"group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										isActive
											? "bg-primary text-primary-foreground shadow-sm"
											: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
									)}
								>
									<item.icon
										className={cn(
											"h-4 w-4",
											isActive
												? "text-primary-foreground"
												: "text-muted-foreground group-hover:text-accent-foreground",
										)}
									/>
									{item.title}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			{/* Footer Actions */}
			<div className="border-t border-border/40 p-4">
				<button
					type="button"
					className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<LogOut className="h-4 w-4" />
					Keluar
				</button>
			</div>
		</aside>
	);
}
