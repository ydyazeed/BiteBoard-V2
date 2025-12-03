import { create } from 'zustand'

interface UIState {
    isWishlistOpen: boolean
    toggleWishlist: () => void
    setWishlistOpen: (open: boolean) => void
    selectedWishlistId: string | null
    setSelectedWishlistId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
    isWishlistOpen: false,
    toggleWishlist: () => set((state) => ({ isWishlistOpen: !state.isWishlistOpen })),
    setWishlistOpen: (open) => set({ isWishlistOpen: open }),
    selectedWishlistId: null,
    setSelectedWishlistId: (id) => set({ selectedWishlistId: id }),
}))
