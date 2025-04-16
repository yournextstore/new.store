import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BetterAuthView } from "../auth/[pathname]/view";

export default async function Page() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (session?.user) {
		return redirect("/admin");
	}

	return (
		<Suspense>
			<BetterAuthView view={"signIn"} />
		</Suspense>
	);
}
