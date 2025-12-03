import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

export async function POST(request: Request) {
    try {
        const { lat, lng } = await request.json()

        if (!lat || !lng) {
            return NextResponse.json({ error: 'Latitude and Longitude are required' }, { status: 400 })
        }

        // 1. Fetch Cafes from Google Places API
        const placesUrl = `https://places.googleapis.com/v1/places:searchNearby`
        const placesResponse = await fetch(placesUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.rating,places.userRatingCount',
            },
            body: JSON.stringify({
                includedTypes: ['cafe', 'coffee_shop'],
                maxResultCount: 10, // Limit to 10 for performance
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: lat,
                            longitude: lng,
                        },
                        radius: 5000.0, // 5km radius
                    },
                },
            }),
        })

        if (!placesResponse.ok) {
            const errorText = await placesResponse.text();
            console.error('Google Places API Error:', errorText);
            return NextResponse.json({ error: 'Failed to fetch places', details: errorText }, { status: 500 });
        }

        const placesData = await placesResponse.json()
        const places = placesData.places || []

        const supabase = await createClient()

        // 2. Process each place (check cache or call Gemini)
        const processedPlaces = await Promise.all(
            places.map(async (place: any) => {
                const placeId = place.id

                // Check cache
                const { data: cachedData } = await supabase
                    .from('cafe_ai_cache')
                    .select('analysis_json')
                    .eq('place_id', placeId)
                    .single()

                if (cachedData) {
                    return { ...place, ai_recommendations: cachedData.analysis_json }
                }

                // Fetch Reviews (we need a separate call for reviews if not included in searchNearby, 
                // but searchNearby usually doesn't return full reviews. We need Place Details for reviews)
                // Actually, we can try to fetch reviews in the field mask if available, but searchNearby might not support it fully or it's expensive.
                // Let's fetch details for reviews.

                const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`
                const detailsResponse = await fetch(detailsUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                        'X-Goog-FieldMask': 'reviews',
                    }
                })

                let reviewsText = ""
                if (detailsResponse.ok) {
                    const detailsData = await detailsResponse.json()
                    if (detailsData.reviews) {
                        reviewsText = detailsData.reviews.map((r: any) => r.text?.text).join('\n\n')
                    }
                }

                let aiAnalysis = null
                if (reviewsText) {
                    // Call Gemini
                    try {
                        const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
                        const prompt = `Analyze these reviews for the cafe "${place.displayName.text}". Identify the top 3-5 recommended dishes/drinks and count the number of positive mentions for each. Return ONLY a JSON array of objects with keys: "dish_name" (string), "mentions" (number), "description" (short string). Reviews:\n\n${reviewsText}`

                        const result = await model.generateContent(prompt)
                        const response = await result.response
                        const text = response.text()

                        // Clean up JSON string if needed (Gemini sometimes adds markdown)
                        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim()
                        aiAnalysis = JSON.parse(jsonString)

                        // Save to cache
                        await supabase.from('cafe_ai_cache').upsert({
                            place_id: placeId,
                            analysis_json: aiAnalysis,
                            last_updated: new Date().toISOString()
                        })
                    } catch (error) {
                        console.error('Gemini Error:', error)
                        // Fallback or ignore
                    }
                }

                return { ...place, ai_recommendations: aiAnalysis }
            })
        )

        return NextResponse.json({ places: processedPlaces })
    } catch (error) {
        console.error('API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
