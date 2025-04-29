'use client';
import { Copy } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { formatDateTime, formatRelativeTime } from '@/utils/format-date';

interface ImageItem {
  id: string;
  blob_url: string;
  description: string;
  hash: string;
  filename: string | null;
  shortName: string | null;
  blob_pathname: string;
  layout_hint: 'left' | 'right' | 'center' | null;
  image_type: 'product' | 'hero' | null;
  source: string;
  created_at: string;
  generation_prompt?: string | null;
}

interface ImageDetailDialogProps {
  image: ImageItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageDetailDialog({
  image,
  open,
  onOpenChange,
}: ImageDetailDialogProps) {
  if (!image) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: `${label} has been copied to your clipboard.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {image.shortName || image.filename || 'Image Details'}
          </DialogTitle>
          <DialogDescription>
            Detailed information about this image
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative aspect-square bg-muted rounded-md overflow-hidden">
            <Image
              src={image.blob_url || '/placeholder.svg'}
              alt={image.description}
              fill
              className="object-contain"
            />
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Description
              </h3>
              <p>{image.description}</p>
            </div>

            {/* Add Generation Prompt Section */}
            {image.generation_prompt && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center">
                  Generation Prompt
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1"
                    onClick={() =>
                      copyToClipboard(
                        image.generation_prompt || '',
                        'Generation Prompt',
                      )
                    }
                    title="Copy prompt"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </h3>
                <p className="text-xs whitespace-pre-wrap break-words font-mono bg-muted p-2 rounded">
                  {image.generation_prompt}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  image.image_type === 'product' ? 'default' : 'secondary'
                }
              >
                {image.image_type || 'Unknown type'}
              </Badge>
              <Badge variant="outline">{image.source}</Badge>
              {image.layout_hint && (
                <Badge variant="outline">Layout: {image.layout_hint}</Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  ID
                </span>
                <div className="flex items-center">
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    {image.id}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-1"
                    onClick={() => copyToClipboard(image.id, 'ID')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Blob URL
                </span>
                <div className="flex items-center">
                  <code className="bg-muted px-1 py-0.5 rounded text-xs truncate max-w-[200px]">
                    {image.blob_url}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-1"
                    onClick={() => copyToClipboard(image.blob_url, 'Blob URL')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Path
                </span>
                <div className="flex items-center">
                  <code className="bg-muted px-1 py-0.5 rounded text-xs truncate max-w-[200px]">
                    {image.blob_pathname}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-1"
                    onClick={() => copyToClipboard(image.blob_pathname, 'Path')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Created
                </span>
                <div className="text-sm">
                  <span>{formatRelativeTime(image.created_at)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(image.created_at)}
                  </span>
                </div>
              </div>

              {image.hash && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    Hash
                  </span>
                  <div className="flex items-center">
                    <code className="bg-muted px-1 py-0.5 rounded text-xs truncate max-w-[150px]">
                      {image.hash}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-1"
                      onClick={() => copyToClipboard(image.hash, 'Hash')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
