import Link from "next/link";

const genreCards = [
	{ title: "Tekkin House Nomads", description: "House rhythms shaped for club nights", slug: "house" },
	{ title: "Future Tekno", description: "Dark techno cuts with modern twists", slug: "techno" },
	{ title: "Melodic Journeys", description: "Warm pads and floating grooves", slug: "melodic" },
	{ title: "Deep Pulse", description: "Underground bass for late nights", slug: "deep" },
	{ title: "Atmos Mini-Set", description: "Experimentals and ambient bangers", slug: "ambient" },
];

export default function GenrePlaylistsRow() {
	return (
		<section>
			<div className="mb-4 flex items-end justify-between">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Genre Playlists</p>
					<h3 className="mt-1 text-xl font-semibold text-white">Playlist per genere</h3>
				</div>
				<Link
					href="/charts"
					className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 hover:text-white"
				>
					Vedi tutte
				</Link>
			</div>

			<div className="flex gap-6 overflow-x-auto">
				{genreCards.map((g) => (
					<Link key={g.slug} href={`/charts/genre/${g.slug}`} className="w-[260px] shrink-0">
						<div className="aspect-[16/10] rounded-2xl bg-zinc-950 border border-zinc-900" />

						<div className="mt-3">
							<p className="text-sm font-semibold text-white">{g.title}</p>
							<p className="mt-1 text-xs text-slate-400">{g.description}</p>
						</div>
					</Link>
				))}
			</div>
		</section>
	);
}
