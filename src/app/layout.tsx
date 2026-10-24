import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "./providers";

const display = Big_Shoulders({
	weight: ["700", "800", "900"],
	subsets: ["latin"],
	variable: "--font-display",
	display: "swap",
	preload: true,
	adjustFontFallback: false,
});

const text = Archivo({
	subsets: ["latin"],
	axes: ["wdth"],
	variable: "--font-text",
	display: "swap",
	preload: true,
});

export const metadata: Metadata = {
	title: { default: "Figu", template: "%s, Figu" },
	description:
		"Ranking de vendedores como cartas de jugador. Caso La Virginia, Shippe.ar Hackathon 3.",
};

export const viewport: Viewport = {
	themeColor: "#0e4194",
	colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="es-AR"
			className={`${display.variable} ${text.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				<Providers>
					<SiteHeader />
					<div className="flex-1">{children}</div>
					<SiteFooter />
				</Providers>
			</body>
		</html>
	);
}
