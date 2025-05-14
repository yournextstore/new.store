'use client';

import { useState, useEffect, useTransition } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import StoreGrid from './store-grid';
import { toggleStarAction } from './actions';
import type { Store } from './types';

interface MyStoresClientProps {
  initialStores: Store[];
  initialFetchError: string | null;
}

export default function MyStoresClient({
  initialStores,
  initialFetchError,
}: MyStoresClientProps) {
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [filteredStores, setFilteredStores] = useState<Store[]>(initialStores);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(
    initialFetchError,
  );
  const [isTogglingStar, startToggleStarTransition] = useTransition();

  useEffect(() => {
    if (!initialFetchError) {
      setStores(initialStores);
      setFilteredStores(initialStores);
    } else {
      setStores([]);
      setFilteredStores([]);
    }
    setFetchError(initialFetchError);
  }, [initialStores, initialFetchError]);

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
        const result = await toggleStarAction(storeId);

        if (result.error) {
          throw new Error(result.error || 'Failed to update star status');
        }

        if (result.id && typeof result.is_starred === 'boolean') {
          const updatedIsStarred = result.is_starred;
          setStores((prevStores) =>
            prevStores.map((store) =>
              store.id === result.id
                ? { ...store, is_starred: updatedIsStarred }
                : store,
            ),
          );
        }

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
    let filtered = [...stores];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((store) =>
        store.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Filter by tab
    if (activeTab === 'starred') {
      filtered = filtered.filter((store) => store.is_starred);
    }

    setFilteredStores(filtered);
  };

  if (isLoading && !initialFetchError) {
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
          />
        </div>
        <Tabs
          defaultValue="all"
          className="w-full sm:w-auto"
          onValueChange={setActiveTab}
        >
          <TabsList>
            <TabsTrigger value="all">All Stores</TabsTrigger>
            <TabsTrigger value="starred">Starred</TabsTrigger>
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
                : "You haven't generated any stores yet."}
          </p>
          {!searchQuery && activeTab !== 'starred' && (
            <Button asChild className="mt-4">
              <Link href="/generate">Generate Your First Store</Link>
            </Button>
          )}
        </div>
      ) : (
        <StoreGrid
          storesToDisplay={filteredStores}
          onToggleStar={handleToggleStar}
          isTogglingStar={isTogglingStar}
        />
      )}
    </div>
  );
}
