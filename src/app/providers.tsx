"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient } from "@/lib/query/client";

// NuqsAdapter is mounted per page (inside its own Suspense): at the root its
// useSearchParams would make the whole app client-rendered past the layout.
export function Providers({ children }: { children: React.ReactNode }) {
	const queryClient = getQueryClient();
	return (
		<QueryClientProvider client={queryClient}>
			{children}
			<ReactQueryDevtools />
		</QueryClientProvider>
	);
}
