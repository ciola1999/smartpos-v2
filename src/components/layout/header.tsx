export function Header() {
	return (
		<header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border/40 bg-background/80 px-6 backdrop-blur-md">
			<div className="flex flex-1 items-center justify-between">
				<h1 className="text-lg font-semibold tracking-tight text-foreground">
					Overview
				</h1>
				{/* Placeholder User Nav */}
				<div className="h-8 w-8 rounded-full bg-secondary ring-1 ring-border" />
			</div>
		</header>
	);
}
