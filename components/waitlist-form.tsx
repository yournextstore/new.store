"use client";

import { useState, useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormState = "idle" | "loading" | "success" | "error";

const LOOPS_FORM_ID = "clylg5oer002gg55jtffbwibi";

export function WaitlistForm() {
	const [state, setState] = useState<FormState>("idle");
	const [errorMessage, setErrorMessage] = useState("Oops! Something went wrong, please try again");
	const inputRef = useRef<HTMLInputElement>(null);

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const email = inputRef.current?.value;
		if (!email) return;

		// Rate limiting check
		const time = new Date();
		const timestamp = time.valueOf();
		const previousTimestamp = localStorage.getItem("loops-form-timestamp");

		if (previousTimestamp && Number(previousTimestamp) + 60000 > timestamp) {
			setState("error");
			setErrorMessage("Too many signups, please try again in a little while");
			return;
		}
		localStorage.setItem("loops-form-timestamp", String(timestamp));

		setState("loading");

		const formBody = `userGroup=&mailingLists=&source=new.store&email=${encodeURIComponent(email)}`;

		try {
			const res = await fetch(`https://app.loops.so/api/newsletter-form/${LOOPS_FORM_ID}`, {
				method: "POST",
				body: formBody,
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
			});

			if (res.ok) {
				setState("success");
				if (inputRef.current) {
					inputRef.current.value = "";
				}
			} else {
				const data = await res.json();
				setState("error");
				setErrorMessage(data.message || res.statusText || "Something went wrong");
			}
		} catch (error) {
			if (error instanceof Error && error.message === "Failed to fetch") {
				setState("error");
				setErrorMessage("Too many signups, please try again in a little while");
			} else {
				setState("error");
				if (error instanceof Error && error.message) {
					setErrorMessage(error.message);
				}
			}
			localStorage.setItem("loops-form-timestamp", "");
		}
	};

	const handleReset = () => {
		setState("idle");
		setErrorMessage("Oops! Something went wrong, please try again");
	};

	if (state === "success") {
		return (
			<div className="flex flex-col items-center gap-3">
				<p className="text-sm text-foreground">Thanks! We'll be in touch!</p>
				<button
					type="button"
					onClick={handleReset}
					className="text-sm text-muted-foreground hover:text-foreground hover:underline"
				>
					&larr; Back
				</button>
			</div>
		);
	}

	if (state === "error") {
		return (
			<div className="flex flex-col items-center gap-3">
				<p className="text-sm text-destructive">{errorMessage}</p>
				<button
					type="button"
					onClick={handleReset}
					className="text-sm text-muted-foreground hover:text-foreground hover:underline"
				>
					&larr; Back
				</button>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-row items-center justify-center gap-2 w-full max-w-md">
			<Input
				ref={inputRef}
				type="email"
				name="email"
				placeholder="you@example.com"
				required
				disabled={state === "loading"}
				className="flex-1 min-w-0 bg-white dark:bg-background"
			/>
			<Button type="submit" disabled={state === "loading"} className="shrink-0">
				{state === "loading" ? "Please wait..." : "Join Waitlist"}
			</Button>
		</form>
	);
}
