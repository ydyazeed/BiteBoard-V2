import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { place_id } = await request.json()

        if (!place_id) {
            return NextResponse.json({ error: 'Place ID is required' }, { status: 400 })
        }

        const apiKey = process.env.GOOGLE_PLACES_API_KEY
        if (!apiKey) {
            throw new Error('Google Places API key is missing')
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry&key=${apiKey}`,
            { method: 'GET' }
        )

        if (!response.ok) {
            throw new Error('Failed to fetch from Google Places API')
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Places Details Error:', error)
        return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 })
    }
}
