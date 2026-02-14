import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "export", // 👈 WAJIB: Generate HTML static
	images: {
		unoptimized: true, // 👈 WAJIB: Tauri tidak punya Image Optimization server
	},
};

export default nextConfig;
