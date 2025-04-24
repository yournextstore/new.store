import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { imageAdd, imageList } from "@/db/image";

// Schema for validating image input
const ImageSchema = z.object({
	title: z.string().min(1, "Title is required"),
	url: z.string().url("Valid URL is required"),
	description: z.string().optional(),
});

// GET /api/images - Fetch all images
export async function GET() {
	try {
		return NextResponse.json(imageList, { status: 200 });
	} catch (error) {
		console.error("Error fetching images:", error);
		return NextResponse.json(
			{ error: "Failed to fetch images" },
			{ status: 500 },
		);
	}
}

// POST /api/images - Add a new image
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Validate input
		const result = ImageSchema.safeParse(body);
		if (!result.success) {
			return NextResponse.json(
				{ error: "Invalid image data", details: result.error.format() },
				{ status: 400 },
			);
		}

		// Add the image
		const newImage = imageAdd(result.data);

		return NextResponse.json(newImage, { status: 201 });
	} catch (error) {
		console.error("Error adding image:", error);
		return NextResponse.json({ error: "Failed to add image" }, { status: 500 });
	}
}
