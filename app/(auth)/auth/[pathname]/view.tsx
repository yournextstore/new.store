"use client";

import { AuthCard, type AuthView } from "@daveyplate/better-auth-ui";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

export function BetterAuthView({
	pathname,
	view,
}: { pathname: string; view?: AuthView } | { view: AuthView; pathname?: string }) {
	const router = useRouter();

	useEffect(() => {
		// Clear router cache (protected routes)
		router.refresh();
	}, []);

	return (
		<main className="flex flex-col grow p-4 items-center justify-center">
			<Suspense>
				<AuthCard pathname={pathname} view={view} className="w-sm max-w-full" />
			</Suspense>
		</main>
	);
}
