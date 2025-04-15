import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { Writable } from 'stream';

// A helper, one-off script to download the initial images from the scratchpad

// Data copied from the scratchpad
const imageData = {
  images: [
    {
      imageUrl: "https://fpvnqhp6jqce9ax6.public.blob.vercel-storage.com/images/019610fa-22f5-7637-bb96-aae581db5744/test/image-rcnmRcA1JDoTyqrWeT9zegZLPQR9qX.png",
      shortName: "Natural beige sneaker",
      alt: "Minimalist beige sneaker with a textured fabric upper, black laces, and a clean white sole, photographed on a light neutral background for an online store display."
    },
    {
      imageUrl: "https://fpvnqhp6jqce9ax6.public.blob.vercel-storage.com/images/019610fa-22f5-7637-bb96-aae581db5744/test/image-qbZkaBag6P1VyXpBsgXetjiRiJRqe7.png",
      shortName: "Lavender Casual Sneaker",
      alt: "A minimalist low-top sneaker in soft lavender with a white sole and black eyelets, perfect for a subtle yet stylish look."
    },
    {
      imageUrl: "https://fpvnqhp6jqce9ax6.public.blob.vercel-storage.com/images/019610fa-22f5-7637-bb96-aae581db5744/test/image-mH7DdOrR1rceRbBTfZXrUMVzrnDDpq.png",
      shortName: "Mustard Yellow Everyday Sneaker",
      alt: "A vibrant mustard yellow sneaker with black laces and a white sole, designed for bold and energetic outfits."
    },
    {
      imageUrl: "https://jtit1h3gvnocbut8.public.blob.vercel-storage.com/images/01948eb4-7b77-70dc-85a2-c3c17a30a3c2/test/quark-gray-hseSkBXrgs887NXdCHUL5EJP7hQfPs.png?w=3840&q=75",
      shortName: "Light Gray Urban Sneaker",
      alt: "A sleek light gray urban sneaker with matching laces and white sole, offering a clean and versatile style for everyday wear."
    },
    {
      imageUrl: "https://fpvnqhp6jqce9ax6.public.blob.vercel-storage.com/images/019610fa-22f5-7637-bb96-aae581db5744/test/image-CX8Ea6LapzoRsdKhI6h6h7vNwb3hH6.png",
      shortName: "Navy Blue Modern Sneaker",
      alt: "A deep navy sneaker with black accents and a white sole, balancing classic and contemporary aesthetics."
    },
    {
      imageUrl: "https://fpvnqhp6jqce9ax6.public.blob.vercel-storage.com/images/019610fa-22f5-7637-bb96-aae581db5744/test/image-saLKXICaYWchH844KPnPuZArnEG2wc.png",
      shortName: "Black and White Classic Sneaker",
      alt: "A timeless black sneaker with tonal laces and a crisp white sole, ideal for a modern, understated wardrobe"
    },
  ]
};

const targetDir = path.join(process.cwd(), 'public', 'images', 'library');
const indexFilePath = path.join(targetDir, 'index.json');

// --- Helper Functions ---

function sanitizeFilename(name: string): string {
  // Convert to lowercase, replace spaces with hyphens, remove non-alphanumeric/hyphen chars
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function downloadImage(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      response.pipe(file as Writable);

      file.on('finish', () => {
        file.close(() => resolve());
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {}); // Delete the file async. (But we might not need to wait for it)
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete the file async.
      reject(err);
    });
  });
}

// --- Main Script Logic ---

async function main() {
  console.log(`Ensuring target directory exists: ${targetDir}`);
  fs.mkdirSync(targetDir, { recursive: true });

  const indexData: Array<{ originalUrl: string; localPath: string; shortName: string; description: string }> = [];

  console.log('Starting image downloads...');

  for (const image of imageData.images) {
    try {
      const fileExtension = path.extname(new URL(image.imageUrl).pathname) || '.png'; // Default to .png if no extension
      const baseName = sanitizeFilename(image.shortName);
      const filename = `${baseName}${fileExtension}`;
      const destinationPath = path.join(targetDir, filename);
      const localImagePath = `/images/library/${filename}`; // Path relative to public dir

      console.log(`Downloading ${image.shortName} from ${image.imageUrl} to ${destinationPath}...`);
      await downloadImage(image.imageUrl, destinationPath);
      console.log(` -> Saved ${filename}`);

      // Add entry to index data
      indexData.push({
        originalUrl: image.imageUrl,
        localPath: localImagePath,
        shortName: image.shortName,
        description: image.alt,
      });

    } catch (error) {
      console.error(`Error downloading ${image.shortName} (${image.imageUrl}):`, error);
      // Decide if you want to stop or continue on error
      // For now, we'll log and continue
    }
  }

  console.log(`
Writing index file to ${indexFilePath}...`);
  fs.writeFileSync(indexFilePath, JSON.stringify(indexData, null, 2));

  console.log('\nImage download and indexing complete.');
  console.log(`${indexData.length} images processed.`);
  console.log(`Index file created at: ${indexFilePath}`);
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
}); 