'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Book, Coffee, Share2, Trash2, Wrench } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function WishlistSheet() {
    const { isWishlistOpen, setWishlistOpen, selectedWishlistId, setSelectedWishlistId } = useUIStore()
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [membersOpen, setMembersOpen] = useState(false)

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const { data } = await supabase.auth.getUser()
            return data.user
        }
    })

    const { data: wishlists } = useQuery({
        queryKey: ['wishlists'],
        queryFn: async () => {
            if (!user) return []
            const { data, error } = await supabase
                .from('wishlists')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            return data
        },
        enabled: !!user,
    })

    // Set default selected wishlist
    useEffect(() => {
        if (wishlists && wishlists.length > 0 && !selectedWishlistId) {
            setSelectedWishlistId(wishlists[0].id)
        }
    }, [wishlists, selectedWishlistId, setSelectedWishlistId])

    const { data: items } = useQuery({
        queryKey: ['wishlist-items', selectedWishlistId],
        queryFn: async () => {
            if (!selectedWishlistId) return []
            const { data, error } = await supabase
                .from('wishlist_items')
                .select('*')
                .eq('wishlist_id', selectedWishlistId)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data
        },
        enabled: !!selectedWishlistId,
    })

    const { data: members } = useQuery({
        queryKey: ['wishlist-members', selectedWishlistId],
        queryFn: async () => {
            if (!selectedWishlistId) return []
            const { data, error } = await supabase
                .from('wishlist_members')
                .select('*, users(full_name, avatar_url, email)')
                .eq('wishlist_id', selectedWishlistId)

            if (error) throw error
            return data
        },
        enabled: !!selectedWishlistId && membersOpen,
    })

    // Realtime Subscription
    useEffect(() => {
        if (!selectedWishlistId) return

        const channel = supabase
            .channel('wishlist-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'wishlist_items',
                    filter: `wishlist_id=eq.${selectedWishlistId}`
                },
                (payload) => {
                    console.log('Realtime update:', payload)
                    queryClient.invalidateQueries({ queryKey: ['wishlist-items', selectedWishlistId] })
                }
            )
            .subscribe()

        const membersChannel = supabase
            .channel('wishlist-members-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'wishlist_members',
                    filter: `wishlist_id=eq.${selectedWishlistId}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['wishlist-members', selectedWishlistId] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
            supabase.removeChannel(membersChannel)
        }
    }, [selectedWishlistId, queryClient, supabase])

    const deleteItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            const { error } = await supabase.from('wishlist_items').delete().eq('id', itemId)
            if (error) throw error
        },
        onSuccess: () => {
            // queryClient.invalidateQueries({ queryKey: ['wishlist-items'] }) // Handled by realtime usually, but good to keep for optimistic/fast UI
            // Actually, let's keep it to ensure UI updates even if realtime is slow
            queryClient.invalidateQueries({ queryKey: ['wishlist-items', selectedWishlistId] })
            toast.success('Item removed')
        }
    })

    const shareWishlist = async () => {
        if (!selectedWishlistId) return
        const wishlist = wishlists?.find(w => w.id === selectedWishlistId)
        if (!wishlist) return

        const url = `${window.location.origin}/invite/${wishlist.share_token}`
        await navigator.clipboard.writeText(url)
        toast.success('Invite link copied to clipboard!')
    }

    const [manualAddOpen, setManualAddOpen] = useState(false)
    const [manualCafe, setManualCafe] = useState('')
    const [manualDish, setManualDish] = useState('')

    const manualAddMutation = useMutation({
        mutationFn: async () => {
            if (!selectedWishlistId) throw new Error('No wishlist selected')
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error } = await supabase
                .from('wishlist_items')
                .insert({
                    wishlist_id: selectedWishlistId,
                    cafe_name: manualCafe,
                    dish_name: manualDish,
                    cafe_place_id: 'manual', // Or null if allowed, but 'manual' is safer for non-null constraint if any
                    added_by: user.id
                })

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wishlist-items', selectedWishlistId] })
            toast.success('Custom spot added!')
            setManualAddOpen(false)
            setManualCafe('')
            setManualDish('')
        },
        onError: (error) => {
            toast.error(error.message)
        }
    })

    if (!user) return null

    return (
        <Sheet open={isWishlistOpen} onOpenChange={setWishlistOpen}>
            <SheetTrigger asChild>
                <Button
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-50 bg-[#4E342E] hover:bg-[#3E2723]"
                    size="icon"
                >
                    <Coffee className="h-6 w-6 text-[#FAF9F6]" />
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md bg-[#FAF9F6] border-l-[#D7CCC8] p-0 flex flex-col h-full overflow-hidden gap-0">
                <div className="p-6 border-b border-[#D7CCC8]/30">
                    <SheetHeader>
                        <SheetTitle className="font-serif text-3xl text-[#4E342E] flex items-center gap-2">
                            <Book className="h-6 w-6" />
                            {user?.user_metadata?.full_name ? `Hello, ${user.user_metadata.full_name}` : 'Your Cravings'}
                        </SheetTitle>
                    </SheetHeader>

                    {/* ... (inside component) */}

                    <div className="mt-6">
                        <Select
                            value={selectedWishlistId || ''}
                            onValueChange={setSelectedWishlistId}
                        >
                            <SelectTrigger className="w-full bg-[#FAF9F6] border-[#4E342E] text-[#4E342E] focus:ring-[#4E342E]">
                                <SelectValue placeholder="Select a wishlist" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#FAF9F6] border-[#D7CCC8]">
                                {wishlists?.map(w => (
                                    <SelectItem
                                        key={w.id}
                                        value={w.id}
                                        className="text-[#4E342E] focus:bg-[#4E342E]/10 focus:text-[#4E342E]"
                                    >
                                        {w.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Active Wishlist Header */}
                <div className="px-6 py-4 bg-[#4E342E]/5 border-b border-[#D7CCC8]/30">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium text-[#5D4037] uppercase tracking-wider">
                            {items?.length || 0} Saved Items
                        </h3>
                        <div className="flex gap-2">
                            <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-[#4E342E] hover:bg-[#4E342E]/10 h-8 px-3">
                                        Members {members && members.length > 0 && `(${members.length})`}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-[#FAF9F6] border-[#D7CCC8]">
                                    <DialogHeader>
                                        <DialogTitle className="font-serif text-[#4E342E]">Wishlist Members</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 mt-4">
                                        {members?.map((member: any) => (
                                            <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#4E342E]/5">
                                                <Avatar>
                                                    <AvatarImage src={member.users?.avatar_url} />
                                                    <AvatarFallback className="bg-[#D7CCC8] text-[#4E342E]">
                                                        {member.users?.full_name?.[0] || member.users?.email?.[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-[#4E342E]">{member.users?.full_name || 'Unknown'}</p>
                                                    <p className="text-xs text-[#8D6E63] capitalize">{member.role}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={shareWishlist}
                                className="border-[#4E342E] text-[#4E342E] hover:bg-[#4E342E] hover:text-[#FAF9F6] transition-colors h-8"
                            >
                                <Share2 className="h-3.5 w-3.5 mr-2" />
                                Invite Friends
                            </Button>
                        </div>
                    </div>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-4 p-6">
                        {items?.map((item) => (
                            <div key={item.id} className="group bg-white p-4 rounded-xl shadow-sm border border-[#EFEBE9] hover:border-[#D7CCC8] transition-all hover:shadow-md">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h4 className="font-serif text-lg font-medium text-[#4E342E]">{item.dish_name}</h4>
                                        <div className="flex items-center text-sm text-[#5D4037]">
                                            <Coffee className="h-3 w-3 mr-1.5 opacity-70" />
                                            {item.cafe_name}
                                        </div>
                                        {item.cafe_address && (
                                            <p className="text-xs text-[#8D6E63] pl-4.5">{item.cafe_address}</p>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-[#D7CCC8] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => deleteItemMutation.mutate(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {items?.length === 0 && (
                            <div className="text-center py-16 text-[#8D6E63] bg-white/50 rounded-xl border border-dashed border-[#D7CCC8] mt-4">
                                <Coffee className="h-8 w-8 mx-auto mb-3 opacity-50" />
                                <p className="font-medium">Your list is empty</p>
                                <p className="text-sm opacity-75">Go find some delicious eats!</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-6 border-t border-[#D7CCC8]/30 bg-[#FAF9F6]">
                    <Dialog open={manualAddOpen} onOpenChange={setManualAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full bg-[#4E342E] hover:bg-[#3E2723] text-[#FAF9F6] h-12 text-lg font-medium">
                                Add Custom Spot
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#FAF9F6] border-[#D7CCC8]">
                            <DialogHeader>
                                <DialogTitle className="font-serif text-[#4E342E]">Add Custom Spot</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[#4E342E]">Cafe Name</label>
                                    <input
                                        className="flex h-10 w-full rounded-md border border-[#D7CCC8] bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4E342E]"
                                        placeholder="e.g. Joe's Coffee"
                                        value={manualCafe}
                                        onChange={(e) => setManualCafe(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[#4E342E]">Dish / Item</label>
                                    <input
                                        className="flex h-10 w-full rounded-md border border-[#D7CCC8] bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4E342E]"
                                        placeholder="e.g. Vanilla Latte"
                                        value={manualDish}
                                        onChange={(e) => setManualDish(e.target.value)}
                                    />
                                </div>
                                <Button
                                    className="w-full bg-[#4E342E] hover:bg-[#3E2723] text-[#FAF9F6]"
                                    onClick={() => manualAddMutation.mutate()}
                                    disabled={!manualCafe || !manualDish}
                                >
                                    Add to Wishlist
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </SheetContent>
        </Sheet>
    )
}
