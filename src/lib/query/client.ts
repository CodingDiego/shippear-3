import {
	defaultShouldDehydrateQuery,
	environmentManager,
	QueryClient,
} from "@tanstack/react-query";
import { cache } from "react";

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { staleTime: 60_000, retry: 1 },
			dehydrate: {
				// Also dehydrate pending queries so server prefetches stream to the client.
				shouldDehydrateQuery: (q) =>
					defaultShouldDehydrateQuery(q) || q.state.status === "pending",
			},
		},
	});
}

// One client per request on the server, one per tab in the browser.
const serverClient = cache(makeQueryClient);
let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
	if (environmentManager.isServer()) return serverClient();
	browserClient ??= makeQueryClient();
	return browserClient;
}
