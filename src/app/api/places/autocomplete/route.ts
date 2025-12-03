import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { input } = await request.json()

        if (!input) {
            return NextResponse.json({ predictions: [] })
        }

        const apiKey = process.env.GOOGLE_PLACES_API_KEY
        if (!apiKey) {
            throw new Error('Google Places API key is missing')
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&types=(cities)`,
            { method: 'GET' }
        )

        if (!response.ok) {
            throw new Error('Failed to fetch from Google Places API')
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Places Autocomplete Error:', error)
        return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
    }
}
