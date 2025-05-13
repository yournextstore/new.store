"use client"

import { StoreCard } from "@/components/store-card"
import type { Store } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"

interface StoreGalleryProps {
  stores: Store[]
  isLoading: boolean
  onVote: (storeId: string, voteType: "up" | "down") => void
}

export function StoreGallery({ stores, isLoading, onVote }: StoreGalleryProps) {
  // If loading, show skeleton UI
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="w-full h-48 rounded-lg" />
            <Skeleton className="w-3/4 h-4 rounded" />
            <Skeleton className="w-1/2 h-4 rounded" />
            <div className="flex justify-between mt-2">
              <Skeleton className="w-20 h-8 rounded" />
              <Skeleton className="w-20 h-8 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // If no stores found
  if (stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-xl font-semibold">No stores found</h3>
        <p className="text-muted-foreground mt-2">Try adjusting your search or check back later for new stores.</p>
      </div>
    )
  }

  // Render the store gallery
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stores.map((store) => (
        <StoreCard key={store.id} store={store} onVote={onVote} />
      ))}
    </div>
  )
}
