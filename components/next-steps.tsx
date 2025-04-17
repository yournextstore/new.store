import { ArrowRight, CreditCard, Package, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function NextSteps() {
	return (
		<Card className="gap-0 py-0 max-w-xl mx-auto border border-primary/10 shadow-sm overflow-hidden">
			<CardHeader className="bg-primary/5 border-b border-primary/10 py-3 pb-3!">
				<CardTitle className="text-lg text-primary">
					Your Store is Ready! 🎉
				</CardTitle>
				<CardDescription className="text-xs">
					Complete these steps to get your store fully operational
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-4 pb-2 space-y-4">
				<div className="flex gap-3">
					<div className="bg-primary/10 p-2 rounded-full h-fit">
						<Settings className="h-4 w-4 text-primary" />
					</div>
					<div className="space-y-0.5">
						<h3 className="font-medium text-sm">Access Your Admin Panel</h3>
						<p className="text-xs text-muted-foreground">
							Visit your admin dashboard to view, add, and edit products.
						</p>
					</div>
				</div>

				<div className="flex gap-3">
					<div className="bg-primary/10 p-2 rounded-full h-fit">
						<CreditCard className="h-4 w-4 text-primary" />
					</div>
					<div className="space-y-0.5">
						<h3 className="font-medium text-sm">Connect Stripe</h3>
						<p className="text-xs text-muted-foreground">
							Link your Stripe account to enable payments and process
							transactions.
						</p>
					</div>
				</div>

				<div className="flex gap-3">
					<div className="bg-primary/10 p-2 rounded-full h-fit">
						<Package className="h-4 w-4 text-primary" />
					</div>
					<div className="space-y-0.5">
						<h3 className="font-medium text-sm">Test Your Checkout</h3>
						<p className="text-xs text-muted-foreground">
							Use Stripe's test cards to simulate purchases and verify your
							checkout flow.
						</p>
					</div>
				</div>
			</CardContent>
			<CardFooter className="bg-primary/5 border-t border-primary/10 py-2">
				<Button className="w-full text-sm h-8" variant="default" asChild>
					<Link href="https://yns.app/admin/products">
						Go to Admin Panel <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
					</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}
