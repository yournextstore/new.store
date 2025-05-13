import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">My Stores</h1>
      <p className="text-muted-foreground mb-8">
        View and manage all the stores you've generated. Star your favorites for easy access.
      </p>
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading your stores...</p>
      </div>
    </div>
  )
}
