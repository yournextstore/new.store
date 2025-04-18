// import { auth } from '@/lib/auth';
// import { ChatInner } from './chat';
// import { headers } from 'next/headers';
// import { redirect } from 'next/navigation';

// export default async function HomePage() {
//   const session = await auth.api.getSession({ headers: await headers() });

//   if (!session?.user) {
//     redirect('/login');
//   }

//   return <ChatInner user={session.user} />;
// }

import Link from "next/link";
import Image from "next/image";
import {
	ArrowRight,
	Sparkles,
	Zap,
	ShoppingBag,
	Clock,
	Code,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChatInner } from "./chat";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function LandingPage() {
	const session = await auth.api.getSession({ headers: await headers() });

	if (session?.user) {
		return <ChatInner user={session.user} />;
	}

	return (
		<div className="flex min-h-screen flex-col">
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
					<div className="flex gap-2 items-center text-xl font-bold">
						<span>new.store</span>
					</div>
					<div className="flex flex-1 items-center justify-end space-x-4">
						<nav className="flex items-center space-x-1"></nav>
					</div>
				</div>
			</header>
			<main className="flex-1">
				<section className="w-full py-12 md:py-24 flex items-center">
					<div className="container px-4 md:px-6">
						<div className="flex flex-col items-center text-center space-y-8">
							<div className="space-y-4 max-w-4xl">
								<div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
									AI-Powered E-commerce
								</div>
								<h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
									Prompt Your E-Commerce Idea. <br />
									<span className="text-primary">
										Make It Alive In Seconds.
									</span>
								</h1>
								<p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
									Transform your e-commerce vision into reality with AI.
									Describe your store concept and watch as our platform
									generates a fully functional online shop instantly.
								</p>
							</div>
							<div className="flex flex-col gap-2 min-[400px]:flex-row">
								<Button size="lg" className="gap-1 rounded-full" asChild>
									<Link href="/login">
										Get Started <ArrowRight className="h-4 w-4" />
									</Link>
								</Button>
							</div>
						</div>
					</div>
				</section>
			</main>
			<footer className="w-full border-t bg-background">
				<div className="container flex flex-col items-center justify-center gap-4 py-10 md:h-24 md:flex-row md:py-0">
					<div className="flex flex-1 items-center justify-center gap-4 md:justify-start">
						<div className="flex gap-2 items-center text-lg font-bold">
							<Sparkles className="h-5 w-5 text-primary" />
							<span>new.store</span>
						</div>
						<p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
							&copy; {new Date().getFullYear()} YNS. All rights reserved.
						</p>
					</div>
				</div>
			</footer>
		</div>
	);
}
