'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StoreGallery } from '@/components/store-gallery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, AlertTriangle } from 'lucide-react';
import type { Store, PaginatedStoresResponse, UserVotesMap } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { voteOnStoreAction } from './actions'; // Server action for voting

interface ExploreClientProps {
  initialStores: Store[];
  initialPagination: PaginatedStoresResponse['pagination'];
  initialUserVotes: UserVotesMap;
  isAuthenticated: boolean;
  initialError: string | null;
}

export default function ExploreClient({
  initialStores,
  initialPagination,
  initialUserVotes,
  isAuthenticated,
  initialError,
}: ExploreClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stores, setStores] = useState<Store[]>(initialStores);
  const [userVotes, setUserVotes] = useState<UserVotesMap>(initialUserVotes);
  const [pagination, setPagination] = useState(initialPagination);
  const [isLoading, setIsLoading] = useState(false); // For actions like voting or page changes initiated by client
  const [error, setError] = useState<string | null>(initialError);

  // Client-side search query
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [isVoting, startVoteTransition] = useTransition();

  // Update state if initial props change (e.g., due to navigation)
  useEffect(() => {
    setStores(initialStores);
    setPagination(initialPagination);
    setUserVotes(initialUserVotes);
    setError(initialError);
  }, [initialStores, initialPagination, initialUserVotes, initialError]);

  const handleVote = async (storeId: string, voteType: 'up' | 'down') => {
    if (!isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to vote.',
        variant: 'destructive',
      });
      return;
    }

    const originalStores = [...stores];
    const originalUserVotes = { ...userVotes };

    // Optimistic UI update
    setStores((prevStores) =>
      prevStores.map((s) => {
        if (s.id === storeId) {
          let newNetVotes = s.netVotes;
          let newUserVote = s.userVote;
          if (newUserVote === voteType) {
            // Clicked same vote button
            newNetVotes += voteType === 'up' ? -1 : 1;
            newUserVote = null;
          } else {
            // New vote or changing vote
            if (newUserVote === 'up') newNetVotes -= 1;
            if (newUserVote === 'down') newNetVotes += 1;
            newNetVotes += voteType === 'up' ? 1 : -1;
            newUserVote = voteType;
          }
          return { ...s, netVotes: newNetVotes, userVote: newUserVote };
        }
        return s;
      }),
    );
    setUserVotes((prev) => {
      const newVotes = { ...prev };
      if (newVotes[storeId] === voteType) delete newVotes[storeId];
      else newVotes[storeId] = voteType;
      return newVotes;
    });

    startVoteTransition(async () => {
      try {
        const result = await voteOnStoreAction(storeId, voteType);
        if (result.error) {
          throw new Error(
            result.details || result.error || 'Failed to record vote.',
          );
        }
        // Revalidation from server action will refresh data, but we can update UI with confirmed state if needed
        // For now, optimistic update + revalidation should be good.
        toast({
          title: 'Vote Recorded!',
          description:
            result.message ||
            (result.newVoteState
              ? `You ${voteType}voted.`
              : 'Your vote was removed.'),
        });
        // Note: `revalidatePath('/explore')` in the action handles data refresh.
        // If direct state update from result is needed:
        // setStores(prev => prev.map(s => s.id === storeId ? {...s, userVote: result.newVoteState} : s));
        // setUserVotes(prev => ({...prev, [storeId]: result.newVoteState}));
      } catch (err: any) {
        setStores(originalStores);
        setUserVotes(originalUserVotes);
        toast({
          title: 'Error Voting',
          description: err.message || 'Could not record your vote.',
          variant: 'destructive',
        });
      }
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && !isLoading) {
      // setIsLoading(true); // Optional: set loading state for page transition
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', newPage.toString());
      router.push(`/explore?${params.toString()}`);
      // Server component will re-fetch and pass new props
    }
  };

  // Client-side filtering for the current page of stores
  const filteredStores = stores.filter((store) =>
    store.promptText.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Render logic (search, gallery, pagination, error handling)
  if (error && stores.length === 0) {
    // Show primary error if initial load failed completely
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 bg-destructive/10 p-4 rounded-md">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h3 className="text-xl font-semibold text-destructive">
          Oops! Something went wrong.
        </h3>
        <p className="text-destructive/80 text-center">{error}</p>
        <Button
          onClick={() => router.refresh()} // Simple refresh to retry server fetch
          variant="destructive"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by prompt..."
          className="w-full pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isLoading} // isLoading primarily for page transitions here
        />
      </div>

      {/* Show loader if client is causing a page change, or initial server load is still happening (via Suspense) */}
      {/* This specific isLoading is for client-side initiated loading, server loading is handled by Suspense in parent */}
      {isLoading && stores.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading stores...</p>
        </div>
      )}

      {!isLoading && stores.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-xl font-semibold">No stores found</h3>
          <p className="text-muted-foreground mt-2">
            It's a bit empty here. Check back later for new stores!
          </p>
        </div>
      )}

      {stores.length > 0 && (
        <StoreGallery
          stores={filteredStores}
          isLoading={false} // StoreGallery's internal skeleton not needed if parent manages it or uses Suspense
          onVote={handleVote}
        />
      )}

      {stores.length > 0 && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1 || isLoading || isVoting}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={
              pagination.currentPage === pagination.totalPages ||
              isLoading ||
              isVoting
            }
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
