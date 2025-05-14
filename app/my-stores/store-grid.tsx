'use client';

import { useState } from 'react';
import { Star, ExternalLink, Search, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import Image from 'next/image';
import Link from 'next/link';
import type { Store } from './types';

interface StoreGridProps {
  storesToDisplay: Store[];
  onToggleStar: (storeId: string) => void;
  isTogglingStar?: boolean;
}

export default function StoreGrid({
  storesToDisplay,
  onToggleStar,
  isTogglingStar,
}: StoreGridProps) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleToggleStar = (storeId: string) => {
    onToggleStar(storeId);
  };

  const openPromptDialog = (store: Store) => {
    setSelectedStore(store);
    setIsDialogOpen(true);
  };

  return (
    <>
      {storesToDisplay.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">No stores to display.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {storesToDisplay.map((store) => (
            <Card key={store.id} className="overflow-hidden flex flex-col">
              <div className="relative aspect-video">
                <Image
                  src={store.hero_image_url || '/placeholder.svg'}
                  alt={`Preview of store: ${store.hero_title || store.prompt_text}`}
                  fill
                  className="object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background/90"
                  onClick={() => handleToggleStar(store.id)}
                  aria-label={store.is_starred ? 'Unstar store' : 'Star store'}
                  disabled={isTogglingStar}
                >
                  <Star
                    className={`h-5 w-5 ${store.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                  />
                </Button>
              </div>
              <CardContent className="flex-grow pt-6">
                <p className="text-sm text-muted-foreground mb-2">
                  Created{' '}
                  {formatDistanceToNow(new Date(store.created_at), {
                    addSuffix: true,
                  })}
                </p>

                {/* Hero title and description */}
                {store.hero_title && (
                  <h3 className="font-medium text-base mb-1">
                    {store.hero_title}
                  </h3>
                )}
                {store.hero_description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {store.hero_description}
                  </p>
                )}

                {/* Prompt with expand option */}
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px bg-border flex-grow" />
                    <span className="text-xs font-medium text-muted-foreground px-1">
                      PROMPT
                    </span>
                    <div className="h-px bg-border flex-grow" />
                  </div>
                  <div className="relative">
                    <p className="text-sm line-clamp-2 pr-6">
                      {store.prompt_text}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 absolute top-0 right-0"
                      onClick={() => openPromptDialog(store)}
                    >
                      <ChevronDown className="h-4 w-4" />
                      <span className="sr-only">View full prompt</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 pb-4">
                <Button asChild variant="outline" className="w-full">
                  <Link
                    href={store.store_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit Store
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Full prompt dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedStore?.hero_title || 'Store Prompt'}
            </DialogTitle>
            <DialogDescription>
              {selectedStore?.hero_description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative aspect-video rounded-md overflow-hidden">
              {selectedStore && (
                <Image
                  src={selectedStore.hero_image_url || '/placeholder.svg'}
                  alt={`Preview of store: ${selectedStore.hero_title || selectedStore.prompt_text}`}
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px bg-border flex-grow" />
                <span className="text-xs font-medium text-muted-foreground px-1">
                  PROMPT
                </span>
                <div className="h-px bg-border flex-grow" />
              </div>
              <p className="text-sm">{selectedStore?.prompt_text}</p>
            </div>
            <div className="flex justify-between">
              <p className="text-xs text-muted-foreground">
                Created{' '}
                {selectedStore &&
                  formatDistanceToNow(new Date(selectedStore.created_at), {
                    addSuffix: true,
                  })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() =>
                  selectedStore && handleToggleStar(selectedStore.id)
                }
                disabled={isTogglingStar}
              >
                <Star
                  className={`h-4 w-4 mr-1 ${
                    selectedStore?.is_starred
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  }`}
                />
                {selectedStore?.is_starred ? 'Starred' : 'Star'}
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button asChild>
                <Link
                  href={selectedStore?.store_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Visit Store
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
