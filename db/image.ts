import { v4 as uuidv4 } from "uuid";

// Define the Image type
export interface Image {
	id: string;
	title: string;
	url: string;
	description?: string;
	createdAt: string;
}

// In-memory store for images
export const imageList: Image[] = [
	{
		id: "1",
		title: "Sample Image",
		url: "https://example.com/sample.jpg",
		description: "A sample image",
		createdAt: new Date().toISOString(),
	},
];

// Get image by ID
export function imageGetById(id: string): Image | undefined {
	return imageList.find((image) => image.id === id);
}

// Add a new image
export function imageAdd(imageData: Omit<Image, "id" | "createdAt">): Image {
	const newImage: Image = {
		id: uuidv4(),
		...imageData,
		createdAt: new Date().toISOString(),
	};

	imageList.push(newImage);
	return newImage;
}
