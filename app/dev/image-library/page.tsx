'use client';

import type React from 'react';

import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { useDebounceValue } from 'usehooks-ts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageDetailDialog } from '@/components/image-detail-dialog';
import { formatRelativeTime } from '@/utils/format-date';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Types based on your database schema
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

interface ApiResponse {
  images: ImageItem[];
  totalCount: number;
}

export default function ImageLibrary() {
  const [searchTerm, setSearchTerm] = useState('');
  const [imageType, setImageType] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsPerPage = 16;
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Debounce the search term using useDebounceValue
  const [debouncedSearchTerm] = useDebounceValue(searchTerm, 500);

  // Function to fetch images from the API
  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: itemsPerPage.toString(),
      imageType: imageType,
      source: source,
    });

    // Use the debounced term for the query
    if (debouncedSearchTerm) {
      params.set('query', debouncedSearchTerm);
    }

    try {
      const response = await fetch(
        `/api/dev/image-library/search?${params.toString()}`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `API request failed with status ${response.status}`,
        );
      }

      const data: ApiResponse = await response.json();

      setImages(data.images);
      // Ensure totalPages is at least 1
      setTotalPages(Math.max(1, Math.ceil(data.totalCount / itemsPerPage)));
    } catch (err: any) {
      console.error('Failed to fetch images:', err);
      setError(err.message || 'An unexpected error occurred');
      setImages([]); // Clear images on error
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    debouncedSearchTerm, // Depend on the debounced value
    imageType,
    source,
  ]);

  // Fetch images when dependencies change
  useEffect(() => {
    fetchImages();
  }, [fetchImages]); // fetchImages includes all its dependencies

  // Reset page to 1 when filters or debounced search term change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, imageType, source]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages && !loading) {
      setCurrentPage(newPage);
    }
  };

  const handleImageClick = (image: ImageItem) => {
    setSelectedImage(image);
    setDetailDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Image Library</h1>
        <p className="text-muted-foreground">
          Browse, search, and manage images for your e-commerce site
        </p>
      </div>

      <div className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by description or filename..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-row gap-2">
            <Select
              value={imageType}
              onValueChange={(value) => setImageType(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Image Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="hero">Hero</SelectItem>
              </SelectContent>
            </Select>

            <Select value={source} onValueChange={(value) => setSource(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="static">Static</SelectItem>
                <SelectItem value="getimg.ai">GetImg.ai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs
          defaultValue="grid"
          value={viewMode}
          onValueChange={(value) => setViewMode(value as 'grid' | 'table')}
        >
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="grid">Grid View</TabsTrigger>
              <TabsTrigger value="table">Table View</TabsTrigger>
            </TabsList>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="grid" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: itemsPerPage }).map((_, i) => (
                  <Card key={`skeleton-grid-${i + 1}`}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-[200px] w-full rounded-md" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !error && images.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No images found matching your criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => (
                  <Card
                    key={image.id}
                    className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleImageClick(image)}
                  >
                    <CardContent className="p-0">
                      <div className="relative h-48 bg-muted">
                        <Image
                          src={image.blob_url || '/placeholder.svg'}
                          alt={image.description || 'Library image'}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant={
                              image.image_type === 'product'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {image.image_type || 'Unknown'}
                          </Badge>
                          <Badge variant="outline">{image.source}</Badge>
                          {image.layout_hint && (
                            <Badge variant="outline">
                              Layout: {image.layout_hint}
                            </Badge>
                          )}
                        </div>
                        <h3
                          className="font-medium truncate"
                          title={image.shortName || image.filename || ''}
                        >
                          {image.shortName || image.filename || 'Unnamed'}
                        </h3>
                        <p
                          className="text-sm text-muted-foreground line-clamp-2"
                          title={image.description}
                        >
                          {image.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(image.created_at)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Preview</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Path</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: itemsPerPage }).map((_, i) => (
                      <TableRow key={`skeleton-row-${i + 1}`}>
                        <TableCell>
                          <Skeleton className="h-12 w-12 rounded-md" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !error && images.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No images found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    images.map((image) => (
                      <TableRow
                        key={image.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleImageClick(image)}
                      >
                        <TableCell>
                          <div className="relative h-12 w-12 rounded-md overflow-hidden">
                            <Image
                              src={image.blob_url || '/placeholder.svg'}
                              alt={image.description || 'Library image'}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate" title={image.description}>
                            {image.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          {image.filename || image.shortName || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              image.image_type === 'product'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {image.image_type || 'Unknown'}
                          </Badge>
                          {image.layout_hint && (
                            <Badge variant="outline" className="ml-1">
                              {image.layout_hint}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{image.source}</TableCell>
                        <TableCell className="text-sm">
                          {formatRelativeTime(image.created_at)}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div
                            className="truncate font-mono text-xs"
                            title={image.blob_pathname}
                          >
                            {image.blob_pathname}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ImageDetailDialog
        image={selectedImage}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
