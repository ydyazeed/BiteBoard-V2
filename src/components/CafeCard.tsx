'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, MapPin, Star } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LoginDialog } from './LoginDialog'
import { AddToWishlistDialog } from './AddToWishlistDialog'
import Image from 'next/image'

interface Dish {
    dish_name: string
    mentions: number
    description: string
}

interface Cafe {
    id: string
    displayName: { text: string }
    formattedAddress: string
    rating: number
    userRatingCount: number
    photos?: { name: string }[]
    ai_recommendations?: Dish[] | null
}

interface CafeCardProps {
    cafe: Cafe
}

export function CafeCard({ cafe }: CafeCardProps) {
    const [loginOpen, setLoginOpen] = useState(false)
    const [addOpen, setAddOpen] = useState(false)
    const [selectedDish, setSelectedDish] = useState<Dish | null>(null)

    const handleAddClick = async (dish: Dish) => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setLoginOpen(true)
        } else {
            setSelectedDish(dish)
            setAddOpen(true)
        }
    }

    // Construct photo URL if available
    // Google Places Photo API format: https://places.googleapis.com/v1/{name}/media?key=API_KEY&maxHeightPx=400&maxWidthPx=400
    // But we can't expose API key in img src directly if we want to be secure, but for this demo/MVP it's client side key usage often or proxy.
    // However, the PRD says "Image (from Places API)".
    // Let's use a proxy or just the direct URL if the key is restricted to domain.
    // For now, I'll use a placeholder if no photo, or try to use the direct link with the key (assuming key has Referer restriction).

    const photoUrl = cafe.photos?.[0]
        ? `https://places.googleapis.com/v1/${cafe.photos[0].name}/media?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&maxHeightPx=400&maxWidthPx=600`
        : null

    // No dummy image, just handle no photo gracefully
    // If we want to show a placeholder, we can, but user said "Cards without image is fine"
    // So we can remove the image section if no photo, or keep a minimal header.

    return (
        <>
            <Card className="overflow-hidden border-none shadow-md bg-[#FAF9F6]">
                {/* Only show image if we have a valid photo URL (which we don't really have without proxy/key) 
            For now, let's just hide the image section as requested "Cards without image is fine" 
            unless we really want to show something. 
            Actually, let's keep the header clean.
        */}
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl font-serif text-[#4E342E]">{cafe.displayName.text}</CardTitle>
                            <CardDescription className="flex items-center mt-1 text-xs">
                                <MapPin className="h-3 w-3 mr-1" />
                                {cafe.formattedAddress}
                            </CardDescription>
                        </div>
                        <div className="flex items-center bg-white px-2 py-1 rounded-full shadow-sm">
                            <Star className="h-3 w-3 text-yellow-500 mr-1 fill-yellow-500" />
                            <span className="text-xs font-bold">{cafe.rating}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({cafe.userRatingCount})</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mt-2">
                        <h4 className="text-sm font-semibold text-[#3E2723] mb-2 flex items-center">
                            ✨ AI Recommendation
                        </h4>

                        {cafe.ai_recommendations ? (
                            <div className="space-y-3">
                                {cafe.ai_recommendations.map((dish, idx) => (
                                    <div key={idx} className="flex items-center justify-between group">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm text-[#4E342E]">{dish.dish_name}</span>
                                                <Badge variant="secondary" className="text-[10px] bg-[#D7CCC8] text-[#3E2723] hover:bg-[#D7CCC8]">
                                                    {dish.mentions} mentions
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-1">{dish.description}</p>
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-[#BF360C] hover:text-[#BF360C] hover:bg-[#BF360C]/10"
                                            onClick={() => handleAddClick(dish)}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <span className="text-xs text-muted-foreground animate-pulse">Analysing reviews...</span>
                                </div>
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />

            {selectedDish && (
                <AddToWishlistDialog
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    item={{
                        cafe_place_id: cafe.id,
                        cafe_name: cafe.displayName.text,
                        cafe_address: cafe.formattedAddress,
                        dish_name: selectedDish.dish_name
                    }}
                />
            )}
        </>
    )
}
