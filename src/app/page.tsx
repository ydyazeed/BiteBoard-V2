'use client'

import { Button } from '@/components/ui/button'
import { CafeCard } from '@/components/CafeCard'
import { WishlistSheet } from '@/components/WishlistSheet'
import { useMutation } from '@tanstack/react-query'
import { Loader2, MapPin } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Menu, User as UserIcon } from 'lucide-react'

import { LocationSearch } from '@/components/LocationSearch'
import { LoginDialog } from '@/components/LoginDialog'
import { OnboardingDialog } from '@/components/OnboardingDialog'

export default function Home() {
  const [allPlaces, setAllPlaces] = useState<any[]>([]) // Basic info from Google
  // displayedPlaces is derived from allPlaces and visibleCount
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [initialSearchDone, setInitialSearchDone] = useState(false)
  const [visibleCount, setVisibleCount] = useState(6)
  const [loginOpen, setLoginOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [showSignInTooltip, setShowSignInTooltip] = useState(false)

  // Keep track of how many we've shown from the current batch
  const BATCH_SIZE = 6

  const analyzeMutation = useMutation({
    mutationFn: async (placesToAnalyze: any[]) => {
      // Only send necessary data (id) to minimize payload
      const minimalPayload = placesToAnalyze.map(p => ({ id: p.id }))

      const response = await fetch('/api/cafes/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: minimalPayload }),
      })
      if (!response.ok) throw new Error('Failed to analyze cafes')
      return response.json()
    },
    onSuccess: (data) => {
      // Merge AI results into allPlaces
      setAllPlaces(prev => {
        const newPlaces = [...prev]
        data.places.forEach((analyzedPlace: any) => {
          const index = newPlaces.findIndex(p => p.id === analyzedPlace.id)
          if (index !== -1) {
            newPlaces[index] = { ...newPlaces[index], ...analyzedPlace }
          }
        })
        return newPlaces
      })
      setAnalyzing(false)
      setLoadingMore(false)
    },
    onError: () => {
      toast.error('Failed to get AI recommendations.')
      setAnalyzing(false)
      setLoadingMore(false)
    }
  })

  const searchMutation = useMutation({
    mutationFn: async ({ lat, lng, token }: { lat?: number; lng?: number; token?: string }) => {
      const response = await fetch('/api/cafes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, pageToken: token }),
      })
      if (!response.ok) throw new Error('Failed to fetch cafes')
      return response.json()
    },
    onSuccess: (data) => {
      const newPlaces = data.places || []
      setNextPageToken(data.nextPageToken || null)

      // Append to allPlaces
      setAllPlaces(prev => [...prev, ...newPlaces])
      setInitialSearchDone(true)
    },
    onError: () => {
      toast.error('Could not find cafes nearby.')
      setLoadingMore(false)
    }
  })

  // Helper to load next batch
  const loadNextBatch = () => {
    if (analyzing || searchMutation.isPending) return

    // We don't set loadingMore=true here because we want to show the cafes first, 
    // and then analyze them in background or show "Analyzing..." on the cards themselves.
    // But if we are "Loading More" (pagination), we might want to show a spinner at bottom.
    // Actually, the requirement is: "Show cafes without dishes first in UI, while gemini return the dishes show shimmer effect"

    // So we just trigger analysis for any cafes that don't have ai_recommendations yet.
    // We should pick the next batch of un-analyzed cafes.

    const unanalyzed = allPlaces.filter(p => p.ai_recommendations === undefined)

    if (unanalyzed.length > 0) {
      // Take up to BATCH_SIZE
      const toAnalyze = unanalyzed.slice(0, BATCH_SIZE)
      setAnalyzing(true)
      analyzeMutation.mutate(toAnalyze)
    } else {
      // All current places analyzed. Do we need to fetch more?
      // Only if user clicked "Load More".
      if (loadingMore) {
        if (nextPageToken) {
          searchMutation.mutate({ token: nextPageToken })
        } else {
          toast.info('No more cafes found.')
          setLoadingMore(false)
        }
      }
    }
  }

  // Effect to trigger analysis for visible cafes that need it
  useEffect(() => {
    if (allPlaces.length > 0 && !analyzing) {
      // Check if any visible cafes need analysis
      const visibleCafes = allPlaces.slice(0, visibleCount)
      const needsAnalysis = visibleCafes.filter(p => p.ai_recommendations === undefined)

      if (needsAnalysis.length > 0) {
        // Analyze them (batch up to BATCH_SIZE, though here it's likely just the new ones)
        // Since we want to analyze all 6 if they are new.
        setAnalyzing(true)
        analyzeMutation.mutate(needsAnalysis)
      }
    }
  }, [allPlaces, visibleCount, analyzing, analyzeMutation])

  const handleFindDishes = (lat?: number, lng?: number) => {
    // If lat/lng provided (from manual search), use them
    if (lat && lng) {
      setAllPlaces([])
      setVisibleCount(6)
      setNextPageToken(null)
      setInitialSearchDone(false)

      searchMutation.mutate({ lat, lng })
      return
    }

    // Otherwise use geolocation
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }

    setLoadingMore(true) // Start the "loading" process
    toast.info('Requesting location access...')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Reset state
        setAllPlaces([])
        setVisibleCount(6)
        setNextPageToken(null)
        setInitialSearchDone(false)

        searchMutation.mutate({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
      },
      (error) => {
        console.error(error)
        toast.error('Location permission denied or unavailable.')
        setLoadingMore(false)
      }
    )
  }

  const handleLoadMore = () => {
    // If we have items in queue, just set loadingMore = true, the effect will pick it up.
    // If queue is empty, we need to fetch more.
    setLoadingMore(true)
    if (allPlaces.length <= displayedPlaces.length) {
      if (nextPageToken) {
        searchMutation.mutate({ token: nextPageToken })
      } else {
        toast.info('No more cafes to load.')
        setLoadingMore(false)
      }
    }
  }

  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (!user) {
        // Show tooltip if not signed in
        setShowSignInTooltip(true)
        const timer = setTimeout(() => setShowSignInTooltip(false), 5000)
        return () => clearTimeout(timer)
      } else if (!user.user_metadata?.full_name) {
        // User is signed in but no name
        setOnboardingOpen(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setShowSignInTooltip(true)
        const timer = setTimeout(() => setShowSignInTooltip(false), 5000)
        return () => clearTimeout(timer)
      } else if (!session.user.user_metadata?.full_name) {
        // User is signed in but no name
        setOnboardingOpen(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    toast.success('Signed out')
    window.location.reload() // Reload to clear any user-specific state/queries
  }

  // Render:
  const displayedPlaces = allPlaces.slice(0, visibleCount)

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-[#4E342E] text-[#FAF9F6] pt-24 pb-16 px-6 text-center rounded-b-[2.5rem] shadow-xl">
        <div className="absolute top-4 right-4 z-20">
          {user ? (
            <>
              {/* Desktop View */}
              <div className="hidden md:flex items-center gap-4 bg-[#3E2723]/50 backdrop-blur-sm p-2 pr-4 rounded-full border border-[#FAF9F6]/10">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#FAF9F6]/10 flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-[#FAF9F6]" />
                  </div>
                  <span className="text-[#FAF9F6] font-medium text-sm">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                </div>
                <div className="h-4 w-px bg-[#FAF9F6]/20" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#FAF9F6] hover:bg-[#FAF9F6]/10 hover:text-white h-8 px-2"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>

              {/* Mobile View */}
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-[#FAF9F6] hover:bg-[#3E2723] hover:text-white rounded-full">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-[#FAF9F6] border-[#D7CCC8]">
                    <DropdownMenuLabel className="text-[#4E342E]">
                      <div className="flex flex-col">
                        <span>Signed in as</span>
                        <span className="font-normal text-xs text-[#8D6E63] truncate">
                          {user.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[#D7CCC8]/30" />
                    <DropdownMenuItem
                      className="text-[#4E342E] focus:bg-[#4E342E]/10 focus:text-[#4E342E] cursor-pointer"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <div className="relative">
              <Button
                variant="ghost"
                className="text-[#FAF9F6] hover:bg-[#FAF9F6]/10 hover:text-white font-medium"
                onClick={() => setLoginOpen(true)}
              >
                Sign In
              </Button>
              {showSignInTooltip && (
                <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-white text-[#4E342E] text-sm rounded-lg shadow-xl border border-[#D7CCC8] animate-in fade-in slide-in-from-top-2 z-50">
                  <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-t border-l border-[#D7CCC8] transform rotate-45" />
                  <p className="relative z-10 font-medium">
                    Sign in to view wishlist and add items to wishlist
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="relative z-10 max-w-md mx-auto">
          <h1 className="text-4xl font-serif font-bold mb-4">BiteBoard</h1>
          <p className="text-[#D7CCC8] mb-8 text-lg">
            Discover the best dishes at cafes near you, curated by AI.
          </p>



          <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto mb-8">
            <Button
              size="lg"
              className="bg-[#FAF9F6] text-[#4E342E] hover:bg-[#F5F5DC] font-semibold text-base px-8 h-12 rounded-full shadow-lg transition-transform active:scale-95 w-full"
              onClick={() => handleFindDishes()}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Finding spots...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-5 w-5" />
                  Find Dishes Near Me
                </>
              )}
            </Button>

            <div className="w-full">
              <LocationSearch
                onLocationSelect={(lat, lng) => handleFindDishes(lat, lng)}
                isLoading={loadingMore}
              />
            </div>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#5D4037] rounded-full -translate-x-1/2 -translate-y-1/2 opacity-50 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#3E2723] rounded-full translate-x-1/3 translate-y-1/3 opacity-50 blur-2xl" />
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 mt-8 space-y-6">
        {initialSearchDone && displayedPlaces.length === 0 && !loadingMore && (
          <div className="text-center text-muted-foreground py-10">
            <p>No cafes found nearby with 4+ rating.</p>
            <Button variant="link" onClick={() => handleFindDishes()}>Try Again</Button>
          </div>
        )}

        {displayedPlaces.map((cafe) => (
          <CafeCard key={cafe.id} cafe={cafe} />
        ))}

        {/* Loading Skeletons */}
        {(loadingMore || analyzing) && (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 bg-white rounded-xl shadow-sm animate-pulse" />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {initialSearchDone && !loadingMore && !analyzing && (nextPageToken || allPlaces.length > displayedPlaces.length) && (
          <div className="flex justify-center pt-4 pb-8">
            <Button variant="outline" onClick={handleLoadMore} className="rounded-full px-8">
              Load More Cafes
            </Button>
          </div>
        )}
      </div>

      <WishlistSheet />
      <WishlistSheet />
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      <Toaster />
    </main>
  )
}
