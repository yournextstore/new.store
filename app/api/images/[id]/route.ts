import { type NextRequest, NextResponse } from "next/server";
import { imageGetById } from "@/db/image";

// GET /api/images/[id] - Fetch a specific image by ID
export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const id = params.id;
		const image = imageGetById(id);

		if (!image) {
			return NextResponse.json({ error: "Image not found" }, { status: 404 });
		}

		return NextResponse.json(image, { status: 200 });
	} catch (error) {
		console.error("Error fetching image:", error);
		return NextResponse.json(
			{ error: "Failed to fetch image" },
			{ status: 500 },
		);
	}
}
