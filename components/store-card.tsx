'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Store } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoreCardProps {
  store: Store;
  onVote: (storeId: string, voteType: 'up' | 'down') => void;
}

export function StoreCard({ store, onVote }: StoreCardProps) {
  const [isImageLoading, setIsImageLoading] = useState(true);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <div className="relative aspect-video overflow-hidden">
        <div
          className={cn(
            'absolute inset-0 bg-muted flex items-center justify-center',
            isImageLoading ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span className="text-muted-foreground">Loading...</span>
        </div>
        <Image
          src={store.heroImageUrl || '/placeholder.svg'}
          alt={`Preview of store created with prompt: ${store.promptText}`}
          fill
          className={cn(
            'object-cover transition-opacity duration-300',
            isImageLoading ? 'opacity-0' : 'opacity-100',
          )}
          onLoad={() => setIsImageLoading(false)}
          onError={() => {
            setIsImageLoading(false); // Hide loading indicator even on error
            // Consider logging or setting a state to show a specific error icon if needed
            console.error(
              'Error loading image:',
              store.heroImageUrl,
              'for store ID:',
              store.id,
            );
          }}
        />
      </div>
      <CardContent className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <Badge variant="outline" className="text-xs">
              Store #{store.id.slice(0, 8)}
            </Badge>
            <span className="text-sm font-medium">
              {store.netVotes > 0 ? '+' : ''}
              {store.netVotes} votes
            </span>
          </div>
          <p className="text-sm line-clamp-2 text-muted-foreground mt-1">
            {store.promptText}
          </p>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex items-center gap-1',
              store.userVote === 'up' && 'text-green-600',
            )}
            onClick={() => onVote(store.id, 'up')}
          >
            <ArrowUpCircle className="h-4 w-4" />
            <span>Upvote</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex items-center gap-1',
              store.userVote === 'down' && 'text-red-600',
            )}
            onClick={() => onVote(store.id, 'down')}
          >
            <ArrowDownCircle className="h-4 w-4" />
            <span>Downvote</span>
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
          asChild
        >
          <a href={store.storeUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            <span>Visit</span>
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
