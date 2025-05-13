'use client';

import { useState, useEffect, useTransition } from 'react';
import { Star, ExternalLink, Search, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';

interface Store {
  id: string;
  prompt_text: string;
  store_url: string;
  hero_image_url: string | null;
  is_starred: boolean;
  created_at: string;
}

export default function MyStoresClient() {
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  const [isTogglingStar, startToggleStarTransition] = useTransition();

  useEffect(() => {
    async function fetchStores() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const response = await fetch('/api/me/stores');
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error || `Failed to fetch stores: ${response.status}`,
          );
        }
        const data: Store[] = await response.json();
        setStores(data);
      } catch (error: any) {
        console.error('Failed to fetch stores:', error);
        setFetchError(
          error.message || 'An unknown error occurred while fetching stores.',
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchStores();
  }, []);

  useEffect(() => {
    filterStores();
  }, [stores, searchQuery, activeTab]);

  const handleToggleStar = async (storeId: string) => {
    const originalStores = [...stores];
    setStores((prevStores) =>
      prevStores.map((store) =>
        store.id === storeId
          ? { ...store, is_starred: !store.is_starred }
          : store,
      ),
    );

    startToggleStarTransition(async () => {
      try {
        const response = await fetch(`/api/me/stores/${storeId}/star`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: 'Failed to update star status' }));
          throw new Error(errorData.error || 'Failed to update star status');
        }

        const result = await response.json();
        setStores((prevStores) =>
          prevStores.map((store) =>
            store.id === storeId
              ? { ...store, is_starred: result.is_starred }
              : store,
          ),
        );

        toast({
          title: 'Success',
          description: `Store ${result.is_starred ? 'starred' : 'unstarred'} successfully.`,
        });
      } catch (error: any) {
        setStores(originalStores);
        toast({
          title: 'Error',
          description: error.message || 'Could not update star status.',
          variant: 'destructive',
        });
      }
    });
  };

  const filterStores = () => {
    let currentStores = [...stores];

    if (searchQuery) {
      currentStores = currentStores.filter((store) =>
        store.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (activeTab === 'starred') {
      currentStores = currentStores.filter((store) => store.is_starred);
    }

    setFilteredStores(currentStores);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading your stores...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive-foreground mb-4">
          Error loading stores: {fetchError}
        </p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by prompt..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isLoading || !!fetchError}
          />
        </div>
        <Tabs
          defaultValue="all"
          className="w-full sm:w-auto"
          onValueChange={setActiveTab}
        >
          <TabsList>
            <TabsTrigger value="all" disabled={isLoading || !!fetchError}>
              All Stores
            </TabsTrigger>
            <TabsTrigger value="starred" disabled={isLoading || !!fetchError}>
              Starred
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredStores.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">
            {searchQuery
              ? 'No stores match your search query.'
              : activeTab === 'starred'
                ? "You haven't starred any stores yet."
                : stores.length === 0
                  ? "You haven't generated any stores yet. Get started!"
                  : 'No stores in this view.'}
          </p>
          {!searchQuery && activeTab !== 'starred' && stores.length === 0 && (
            <Button asChild className="mt-4">
              <Link href="/">Generate Your First Store</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => (
            <Card key={store.id} className="overflow-hidden flex flex-col">
              <div className="relative aspect-video">
                <Image
                  src={store.hero_image_url || '/placeholder.svg'}
                  alt={`Preview of store: ${store.prompt_text}`}
                  fill
                  className="object-cover"
                  unoptimized={store.hero_image_url?.includes(
                    'placeholder.svg',
                  )}
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
                <p className="line-clamp-3 text-sm">{store.prompt_text}</p>
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
    </div>
  );
}
