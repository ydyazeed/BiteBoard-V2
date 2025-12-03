'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MapPin, Search, Loader2 } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

interface LocationSearchProps {
    onLocationSelect: (lat: number, lng: number) => void
    isLoading?: boolean
}

export function LocationSearch({ onLocationSelect, isLoading }: LocationSearchProps) {
    const [input, setInput] = useState('')
    const [predictions, setPredictions] = useState<any[]>([])
    const [showPredictions, setShowPredictions] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    const debouncedInput = useDebounce(input, 500)

    useEffect(() => {
        // Only fetch if input changed and it's NOT the result of a selection
        // We can check this by seeing if input matches the selected place description?
        // Or simpler: If user types, clear selectedPlaceId
        if (selectedPlaceId) return

        const fetchPredictions = async () => {
            if (!debouncedInput || debouncedInput.length < 3) {
                setPredictions([])
                return
            }

            setIsSearching(true)
            try {
                const response = await fetch('/api/places/autocomplete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input: debouncedInput }),
                })
                const data = await response.json()
                setPredictions(data.predictions || [])
                setShowPredictions(true)
            } catch (error) {
                console.error('Error fetching predictions:', error)
            } finally {
                setIsSearching(false)
            }
        }

        fetchPredictions()
    }, [debouncedInput, selectedPlaceId])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowPredictions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value)
        setSelectedPlaceId(null) // Clear selection when typing
    }

    const handlePredictionSelect = (placeId: string, description: string) => {
        setInput(description)
        setSelectedPlaceId(placeId)
        setShowPredictions(false)
    }

    const handleSearch = async () => {
        if (!selectedPlaceId) return

        try {
            const response = await fetch('/api/places/details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ place_id: selectedPlaceId }),
            })
            const data = await response.json()

            if (data.result?.geometry?.location) {
                const { lat, lng } = data.result.geometry.location
                onLocationSelect(lat, lng)
            }
        } catch (error) {
            console.error('Error fetching place details:', error)
        }
    }

    return (
        <div ref={wrapperRef} className="relative w-full mx-auto">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Or search by city..."
                        value={input}
                        onChange={handleInputChange}
                        className="pl-10 h-12 text-base bg-white/90 border-[#D7CCC8] text-[#4E342E] placeholder:text-[#8D6E63] focus-visible:ring-[#4E342E] rounded-full shadow-sm"
                        onFocus={() => {
                            if (predictions.length > 0) setShowPredictions(true)
                        }}
                    />
                    {isSearching && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#4E342E]" />
                        </div>
                    )}
                </div>
                <Button
                    onClick={handleSearch}
                    disabled={!selectedPlaceId || isLoading}
                    className="h-12 px-6 text-base font-semibold bg-[#4E342E] hover:bg-[#3E2723] text-[#FAF9F6] rounded-full shadow-lg transition-transform active:scale-95"
                >
                    Search
                </Button>
            </div>

            {showPredictions && predictions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-[#D7CCC8] overflow-hidden">
                    {predictions.map((prediction) => (
                        <button
                            key={prediction.place_id}
                            className="w-full text-left px-4 py-2 text-sm text-[#4E342E] hover:bg-[#4E342E]/5 transition-colors flex items-center gap-2"
                            onClick={() => handlePredictionSelect(prediction.place_id, prediction.description)}
                        >
                            <MapPin className="h-3 w-3 text-[#8D6E63] flex-shrink-0" />
                            <span className="truncate">{prediction.description}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
