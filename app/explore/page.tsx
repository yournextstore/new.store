'use client';

import { useState, useEffect, useCallback } from 'react';
import { StoreGallery } from '@/components/store-gallery';
// import { mockStores } from "@/lib/mock-data" // Remove mock data
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, AlertTriangle } from 'lucide-react';
import type { Store, PaginatedStoresResponse } from '@/lib/types';
import { authClient } from '@/lib/auth-client'; // Import authClient
import { useToast } from '@/hooks/use-toast'; // Import useToast

const STORES_PER_PAGE = 9;

interface UserVotesMap {
  [storeId: string]: 'up' | 'down';
}

export default function ExplorePage() {
  // State for fetched stores and pagination
  const [stores, setStores] = useState<Store[]>([]);
  const [userVotes, setUserVotes] = useState<UserVotesMap>({});
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: STORES_PER_PAGE,
  });
  const [isLoading, setIsLoading] = useState(true); // For main store list fetching
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0); // Added for retry mechanism

  // State for client-side search (operates on the currently fetched page data)
  const [searchQuery, setSearchQuery] = useState('');

  // Assuming better-auth useSession() might return { data: sessionData, isPending: boolean, error: any }
  // Adjust if the actual hook has a different signature.

  const { data: sessionData, isPending: isSessionLoading } =
    authClient.useSession();
  const { toast } = useToast();

  const isAuthenticated = !!sessionData?.user; // Check if user data exists in session

  // Effect to fetch stores and user votes in parallel
  useEffect(() => {
    if (isSessionLoading) return; // Wait for session to resolve

    const fetchAllData = async () => {
      setIsLoading(true);
      setError(null);

      const storesPromise = fetch(
        `/api/showcase/stores?page=${pagination.currentPage}&limit=${STORES_PER_PAGE}`,
      ).then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch stores: ${res.status}`);
        return res.json() as Promise<PaginatedStoresResponse>;
      });

      const userVotesPromise = isAuthenticated
        ? fetch('/api/me/votes').then((res) => {
            if (!res.ok) {
              if (res.status === 401) return {} as UserVotesMap; // Not logged in or session expired, treat as no votes
              throw new Error(`Failed to fetch user votes: ${res.status}`);
            }
            return res.json() as Promise<UserVotesMap>;
          })
        : Promise.resolve({} as UserVotesMap); // If not authenticated, resolve with empty votes

      try {
        const [storesResponse, fetchedUserVotes] = await Promise.all([
          storesPromise,
          userVotesPromise,
        ]);

        setUserVotes(fetchedUserVotes);
        const storesWithUserVotes = storesResponse.data.map((store) => ({
          ...store,
          userVote: fetchedUserVotes[store.id] || null,
        }));
        setStores(storesWithUserVotes);
        setPagination(storesResponse.pagination);
      } catch (err: any) {
        console.error('Error fetching page data:', err);
        setError(err.message || 'An unknown error occurred.');
        setStores([]);
        setUserVotes({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [pagination.currentPage, isAuthenticated, isSessionLoading, retryCount]); // Added retryCount to dependencies

  // Client-side filtering for the current page of stores
  const filteredStores = stores.filter((store) =>
    store.promptText.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle voting (Placeholder - to be fully implemented later)
  const handleVote = async (storeId: string, voteType: 'up' | 'down') => {
    if (isSessionLoading) return;
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
            newNetVotes += voteType === 'up' ? -1 : 1;
            newUserVote = null;
          } else {
            if (newUserVote === 'up') newNetVotes -= 1;
            if (newUserVote === 'down') newNetVotes += 1;
            newNetVotes += voteType === 'up' ? 1 : -1;
            newUserVote = voteType;
          }
          return {
            ...s,
            netVotes: newNetVotes,
            userVote: newUserVote as Store['userVote'],
          };
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

    try {
      const response = await fetch(`/api/showcase/stores/${storeId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voteType }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || 'Failed to record vote. Please try again.',
        );
      }
      const result = await response.json();
      // Update with confirmed state from API
      setStores((prevStores) =>
        prevStores.map((s) =>
          s.id === storeId
            ? { ...s, userVote: result.newVoteState as Store['userVote'] }
            : s,
        ),
      );
      setUserVotes((prevUserVotes) => {
        const newVotes = { ...prevUserVotes };
        if (result.newVoteState === null) {
          delete newVotes[storeId];
        } else {
          newVotes[storeId] = result.newVoteState as 'up' | 'down';
        }
        return newVotes;
      });

      toast({
        title: 'Vote Recorded!',
        description: result.newVoteState
          ? `You ${voteType}voted for the store.`
          : 'You removed your vote for the store.',
      });
    } catch (err: any) {
      console.error('Error voting:', err);
      setStores(originalStores); // Revert optimistic update
      setUserVotes(originalUserVotes);
      toast({
        title: 'Error Voting',
        description: err.message || 'Could not record your vote.',
        variant: 'destructive',
      });
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && !isLoading) {
      setPagination((prev) => ({ ...prev, currentPage: newPage }));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Explore Stores</h1>
          <p className="text-muted-foreground">
            Discover and vote on stores created by the community
          </p>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by prompt..."
            className="w-full pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isLoading || isSessionLoading}
          />
        </div>

        {(isLoading || isSessionLoading) && stores.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading amazing stores...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 bg-destructive/10 p-4 rounded-md">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h3 className="text-xl font-semibold text-destructive">
              Oops! Something went wrong.
            </h3>
            <p className="text-destructive/80 text-center">{error}</p>
            <Button
              onClick={() => {
                setRetryCount((prev) => prev + 1);
              }}
              variant="destructive"
            >
              Try Again
            </Button>
          </div>
        )}

        {!isLoading && !isSessionLoading && !error && stores.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-xl font-semibold">No stores found</h3>
            <p className="text-muted-foreground mt-2">
              It's a bit empty here. Check back later for new stores!
            </p>
          </div>
        )}

        {/* StoreGallery will show its own skeleton for subsequent page loads if stores array is not empty */}
        {/* Pass isLoading to StoreGallery so it can show skeletons during page transitions */}
        {(stores.length > 0 || isLoading || isSessionLoading) && !error && (
          <StoreGallery
            stores={filteredStores}
            isLoading={(isLoading || isSessionLoading) && stores.length === 0}
            onVote={handleVote}
          />
        )}

        {!isLoading &&
          !error &&
          stores.length > 0 &&
          pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1 || isLoading}
              >
                Previous
              </Button>

              {/* Simplified Pagination: Show current page and total pages */}
              <span className="text-sm text-muted-foreground">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>

              <Button
                variant="outline"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={
                  pagination.currentPage === pagination.totalPages || isLoading
                }
              >
                Next
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
