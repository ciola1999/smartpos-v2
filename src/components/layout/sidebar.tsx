"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	ChevronLeft,
	ChevronRight,
	LayoutDashboard,
	LogOut,
	Package,
	Settings,
	ShoppingCart,
	Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

// Definisi Menu (Strict Type)
type MenuItem = {
	href: string;
	label: string;
	icon: React.ElementType;
};

const menuItems: MenuItem[] = [
	{ href: "/dashboard", label: "Overview", icon: LayoutDashboard },
	{ href: "/dashboard/pos", label: "Kasir (POS)", icon: ShoppingCart },
	{ href: "/dashboard/products", label: "Produk", icon: Package },
	{ href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
];

export function Sidebar() {
	const pathname = usePathname();
	const { isOpen, toggle } = useSidebar();

	return (
		<motion.aside
			// Animasi Lebar Sidebar
			initial={false}
			animate={{ width: isOpen ? "16rem" : "5rem" }} // 256px vs 80px
			transition={{ type: "spring", stiffness: 300, damping: 30 }}
			className="relative flex h-screen flex-col border-r bg-card text-card-foreground z-20 overflow-hidden"
		>
			{/* 1. Header Logo Area */}
			<div className="flex h-16 items-center px-4 overflow-hidden whitespace-nowrap">
				<Store className="h-8 w-8 text-primary shrink-0 mr-3" />

				<AnimatePresence>
					{isOpen && (
						<motion.div
							initial={{ opacity: 0, x: -10 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -10 }}
						>
							<h1 className="font-bold text-lg tracking-tight">SmartPOS</h1>
							<p className="text-[10px] text-muted-foreground uppercase tracking-wider">
								Local Hybrid
							</p>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* 2. Navigation Items */}
			<nav className="flex-1 py-6 flex flex-col gap-2 px-3">
				{menuItems.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href;

					return (
						<Link
							key={item.href}
							href={item.href}
							title={!isOpen ? item.label : undefined} // Tooltip saat collapsed
							className={cn(
								"group relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-muted",
								isActive
									? "bg-primary text-primary-foreground hover:bg-primary"
									: "text-muted-foreground",
							)}
						>
							{/* Icon Container */}
							<div className="relative z-10 flex shrink-0 items-center justify-center">
								<Icon
									className={cn(
										"h-5 w-5 transition-transform",
										!isOpen && isActive && "scale-110",
									)}
								/>
							</div>

							{/* Text Label (Animate In/Out) */}
							<AnimatePresence>
								{isOpen && (
									<motion.span
										initial={{ opacity: 0, width: 0 }}
										animate={{ opacity: 1, width: "auto" }}
										exit={{ opacity: 0, width: 0 }}
										className="ml-3 overflow-hidden whitespace-nowrap"
									>
										{item.label}
									</motion.span>
								)}
							</AnimatePresence>

							{/* Active Indicator (Glow Effect) */}
							{isActive && (
								<motion.div
									layoutId="active-nav"
									className="absolute inset-0 rounded-lg bg-primary/10 mix-blend-multiply dark:mix-blend-screen"
									initial={false}
									transition={{ type: "spring", stiffness: 300, damping: 30 }}
								/>
							)}
						</Link>
					);
				})}
			</nav>

			{/* 3. Toggle Button & Footer */}
			<div className="border-t p-3">
				<button
					type="button"
					onClick={toggle}
					className="flex w-full items-center justify-center rounded-md p-2 hover:bg-muted transition-colors text-muted-foreground"
					aria-label={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
				>
					{isOpen ? (
						<ChevronLeft className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
				</button>

				<div className="mt-2 flex justify-center">
					<Link
						href="/"
						className={cn(
							"p-2 text-destructive/80 hover:bg-destructive/10 rounded-md transition-colors",
							isOpen ? "w-full flex items-center gap-2" : "justify-center",
						)}
					>
						<LogOut className="h-5 w-5" />
						{isOpen && <span className="text-sm font-medium">Keluar</span>}
					</Link>
				</div>
			</div>
		</motion.aside>
	);
}
