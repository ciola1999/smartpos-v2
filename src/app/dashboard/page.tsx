"use client";

import { Activity, CreditCard, DollarSign, Users } from "lucide-react";

export default function DashboardPage() {
	return (
		<div className="space-y-6">
			{/* 1. Header Section */}
			<div>
				<h2 className="text-2xl font-bold tracking-tight">Overview</h2>
				<p className="text-muted-foreground">
					Ringkasan performa toko Anda hari ini.
				</p>
			</div>

			{/* 2. Stats Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StatsCard
					title="Total Pendapatan"
					value="Rp 4.200.000"
					desc="+20.1% dari kemarin"
					icon={DollarSign}
				/>
				<StatsCard
					title="Transaksi"
					value="+54"
					desc="+12 sejak 1 jam lalu"
					icon={CreditCard}
				/>
				<StatsCard
					title="Produk Terjual"
					value="120"
					desc="Stok menipis: 3 item"
					icon={Activity}
				/>
				<StatsCard
					title="Pelanggan Baru"
					value="+3"
					desc="+2 sejak jam buka"
					icon={Users}
				/>
			</div>

			{/* 3. Main Content Placeholder */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
				<div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow-sm">
					<div className="p-6">
						<h3 className="font-semibold leading-none tracking-tight">
							Grafik Penjualan
						</h3>
						<p className="text-sm text-muted-foreground mt-2">
							(Area ini akan diisi grafik Recharts nanti)
						</p>
						<div className="mt-4 h-[200px] w-full bg-muted/20 rounded-md border border-dashed flex items-center justify-center text-muted-foreground text-sm">
							Chart Placeholder
						</div>
					</div>
				</div>
				<div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm">
					<div className="p-6">
						<h3 className="font-semibold leading-none tracking-tight">
							Transaksi Terakhir
						</h3>
						<div className="mt-4 h-[200px] w-full bg-muted/20 rounded-md border border-dashed flex items-center justify-center text-muted-foreground text-sm">
							List Placeholder
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// Sub-component untuk Card (supaya rapi)
function StatsCard({ title, value, desc, icon: Icon }: any) {
	return (
		<div className="rounded-xl border bg-card text-card-foreground shadow-sm">
			<div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 className="tracking-tight text-sm font-medium">{title}</h3>
				<Icon className="h-4 w-4 text-muted-foreground" />
			</div>
			<div className="p-6 pt-0">
				<div className="text-2xl font-bold">{value}</div>
				<p className="text-xs text-muted-foreground">{desc}</p>
			</div>
		</div>
	);
}
