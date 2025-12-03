'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

interface AddToWishlistDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    item: {
        cafe_place_id: string
        cafe_name: string
        cafe_address: string
        dish_name: string
    }
}

export function AddToWishlistDialog({ open, onOpenChange, item }: AddToWishlistDialogProps) {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [newWishlistName, setNewWishlistName] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    // Fetch user's wishlists
    const { data: wishlists } = useQuery({
        queryKey: ['wishlists'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return []

            const { data, error } = await supabase
                .from('wishlists')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            return data
        },
        enabled: open,
    })

    const addToWishlistMutation = useMutation({
        mutationFn: async (wishlistId: string) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error } = await supabase
                .from('wishlist_items')
                .insert({
                    wishlist_id: wishlistId,
                    ...item,
                    added_by: user.id
                })

            if (error) throw error
        },
        onSuccess: () => {
            toast.success('Added to wishlist!')
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: ['wishlist-items'] })
        },
        onError: (error) => {
            toast.error(error.message)
        }
    })

    const createWishlistMutation = useMutation({
        mutationFn: async (name: string) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase
                .from('wishlists')
                .insert({
                    title: name,
                    owner_id: user.id
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (newWishlist) => {
            // Automatically add item to the new wishlist
            addToWishlistMutation.mutate(newWishlist.id)
            setNewWishlistName('')
            setIsCreating(false)
            queryClient.invalidateQueries({ queryKey: ['wishlists'] })
        },
        onError: (error) => {
            toast.error(error.message)
        }
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add to Wishlist</DialogTitle>
                    <DialogDescription>
                        Save "{item.dish_name}" to one of your lists.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2 mt-4">
                    {wishlists?.map((wishlist) => (
                        <Button
                            key={wishlist.id}
                            variant="outline"
                            className="justify-start"
                            onClick={() => addToWishlistMutation.mutate(wishlist.id)}
                        >
                            {wishlist.title}
                        </Button>
                    ))}

                    {isCreating ? (
                        <div className="flex gap-2 mt-2">
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                placeholder="New list name..."
                                value={newWishlistName}
                                onChange={(e) => setNewWishlistName(e.target.value)}
                                autoFocus
                            />
                            <Button
                                onClick={() => createWishlistMutation.mutate(newWishlistName)}
                                disabled={!newWishlistName.trim()}
                            >
                                Create
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            className="justify-start text-muted-foreground mt-2"
                            onClick={() => setIsCreating(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Create new list
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
