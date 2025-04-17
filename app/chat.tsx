"use client";

import NextSteps from "@/components/next-steps";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@radix-ui/react-label";
import { RadioGroupItem } from "@radix-ui/react-radio-group";
import type { User } from "better-auth";
import { CheckIcon, ClipboardIcon } from "lucide-react";
import { useEffect, useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { okaidia } from "react-syntax-highlighter/dist/esm/styles/prism";

const Timer = () => {
	const [start, setStart] = useState(0);
	const [time, setTime] = useState(0);

	useEffect(() => {
		setStart(Date.now());
		const interval = setInterval(() => {
			setTime(Date.now());
		}, 50);

		return () => clearInterval(interval);
	}, []);

	return <>{((time - start) / 1000).toFixed(2)}s</>;
};

// Define the available users
const availableUsers = [
	{ id: "eLJ7gEFnW3axnIEGbMAtCSAbpiwwOhZc", name: "gkk.dev" },
	// Add more users here later
];

export const ChatInner = ({ user }: { user: User }) => {
	const [activeTab, setActiveTab] = useState("preview");
	const [prompt, setPrompt] = useState("");
	// State for JSON response
	const [responseJson, setResponseJson] = useState<object | null>(null);
	const [storeUrl, setStoreUrl] = useState<string | null>(null); // State for store URL
	const [generationTime, setGenerationTime] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// State for copy feedback
	const [isCopied, setIsCopied] = useState(false);

	const handleGenerate = async () => {
		setIsLoading(true);
		setError(null);
		setResponseJson(null); // Reset JSON state
		setStoreUrl(null); // Reset store URL state
		setGenerationTime(null);
		try {
			const response = await fetch("/api/generate", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				// Send prompt and selectedUserId
				body: JSON.stringify({ prompt, userId: user.id }), // <-- Send userId
			});

			if (!response.ok) {
				// Try to get more specific error details from the backend response
				const errorData = await response.json().catch(() => ({})); // Gracefully handle non-JSON error responses
				const errorMessage =
					errorData.details || errorData.error || response.statusText;
				throw new Error(`API Error (${response.status}): ${errorMessage}`);
			}

			const data = await response.json();
			// JSON state update
			setResponseJson(data.storeJson);
			setStoreUrl(data.storeUrl); // Set store URL state
			setGenerationTime(data.generationTimeMs);
		} catch (err: any) {
			setError(err.message || "Failed to generate response");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCopy = () => {
		if (responseJson) {
			navigator.clipboard
				.writeText(JSON.stringify(responseJson, null, 2))
				.then(() => {
					setIsCopied(true);
					setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
				})
				.catch((err) => {
					console.error("Failed to copy text: ", err);
					// Optionally show an error message to the user
				});
		}
	};

	return (
		<div className="grid grid-cols-6 gap-4 h-screen px-4">
			{/* Left Column: Input Form */}
			<div className="flex flex-col space-y-4 col-span-2 h-full py-2">
				<h1 className="text-2xl font-bold">
					Generate Your Next Store
					<p className="text-sm font-semibold">
						Logged in as {user.name} ({user.email})
					</p>
				</h1>

				<textarea
					id="prompt-textarea"
					placeholder="Describe your store... e.g., A modern fashion store with minimalist design."
					className="w-full h-40 p-2 border rounded-md resize-none"
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					disabled={isLoading}
				/>
				<div className="flex gap-2 flex-wrap">
					{/* Example Buttons */}
					<Button
						variant="outline"
						onClick={() =>
							setPrompt(
								"Minimalist shoes designed for everyday comfort, style, and motion.",
							)
						}
						disabled={isLoading}
					>
						Minimalist Shoes Store Example
					</Button>
					{/* <Button
            variant="outline"
            onClick={() =>
              setPrompt('A modern fashion store with minimalist design.')
            }
            disabled={isLoading}
          >
            Fashion Store Example
          </Button>
          */}
					<Button
						variant="outline"
						onClick={() =>
							setPrompt("An online shop selling the latest electronic gadgets.")
						}
						disabled={isLoading}
					>
						Electronics Store Example
					</Button>
					<Button
						variant="outline"
						onClick={() =>
							setPrompt("A cozy store for handmade luxury candles.")
						}
						disabled={isLoading}
					>
						Candle Store Example
					</Button>
				</div>
				<Button
					onClick={handleGenerate}
					disabled={isLoading || !prompt}
					className="rounded-full"
				>
					{isLoading ? "Generating..." : "Generate Your Store"}
				</Button>

				{error && <p className="text-red-500">Error: {error}</p>}

				<div className="mt-16">{storeUrl && <NextSteps />}</div>

				{/* TODO: Add toggle/switch for JSON preview */}
				<footer className="mt-auto text-xs py-2">
					<a
						href={`${process.env.NEXT_PUBLIC_YNS_API_URL}/login`}
						target="_blank"
						className="hover:underline"
					>
						{process.env.NEXT_PUBLIC_YNS_API_URL}
					</a>
				</footer>
			</div>

			{/* Right Column: Preview Area */}
			<div className="col-span-4 min-h-full flex flex-col py-2">
				<Tabs
					defaultValue="preview"
					value={activeTab}
					onValueChange={setActiveTab}
					className="w-full flex flex-1 flex-col"
				>
					<div className="flex items-center gap-4">
						<TabsList>
							<TabsTrigger value="preview">Preview</TabsTrigger>
							<TabsTrigger value="json">JSON Output</TabsTrigger>
						</TabsList>
						{isLoading && (
							<span className="text-sm text-gray-600">
								Generating store... <Timer />
							</span>
						)}
						{generationTime !== null && (
							<span className="text-sm text-gray-600">
								Generated in {(generationTime / 1000).toFixed(2)}s
							</span>
						)}
					</div>
					<div className="border rounded-md bg-gray-50 overflow-auto flex flex-col flex-1">
						<TabsContent value="json">
							{responseJson ? (
								<div className="grow overflow-auto mb-4">
									{" "}
									{/* Allow syntax highlighter to scroll, add margin bottom */}
									<SyntaxHighlighter
										language="json"
										style={okaidia}
										customStyle={{ margin: 0, flexGrow: 1 }}
										wrapLongLines={true}
									>
										{JSON.stringify(responseJson, null, 2)}
									</SyntaxHighlighter>
								</div>
							) : (
								!isLoading &&
								!error && (
									<p className="text-gray-500">
										API response will appear here...
									</p>
								)
							)}
						</TabsContent>

						{/* Display Store URL Link Below JSON */}
						<TabsContent value="preview">
							{storeUrl ? (
								<>
									<a
										href={storeUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-neutral-600 px-8 py-1 hover:underline break-all flex"
									>
										{storeUrl}
									</a>
									<div className="border-t flex-1 flex h-full">
										<iframe
											src={storeUrl}
											title="Store Preview"
											className="w-full flex-1 border-0"
										/>
									</div>
								</>
							) : (
								!isLoading &&
								!error && (
									<p className="text-gray-500">
										Your ready to use store will appear here
									</p>
								)
							)}
						</TabsContent>
					</div>
				</Tabs>
			</div>
		</div>
	);
};
