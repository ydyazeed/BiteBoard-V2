import { createClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

export async function POST(request: Request) {
    try {
        const { places } = await request.json() // Expects array of place objects (id, displayName, etc.)

        if (!places || !Array.isArray(places) || places.length === 0) {
            return NextResponse.json({ error: 'Places array is required' }, { status: 400 })
        }

        const supabase = await createClient()
        const results: any[] = []
        const placesToAnalyze: any[] = []

        // 1. Check Cache
        for (const place of places) {
            const { data: cachedData } = await supabase
                .from('cafe_ai_cache')
                .select('analysis_json')
                .eq('place_id', place.id)
                .single()

            if (cachedData) {
                results.push({ ...place, ai_recommendations: cachedData.analysis_json })
            } else {
                placesToAnalyze.push(place)
            }
        }

        // 2. Fetch Reviews & Analyze for missing ones
        if (placesToAnalyze.length > 0) {
            // Fetch reviews for all places to analyze
            const reviewsMap: Record<string, string> = {}

            await Promise.all(placesToAnalyze.map(async (place) => {
                const detailsUrl = `https://places.googleapis.com/v1/places/${place.id}`
                const detailsResponse = await fetch(detailsUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                        'X-Goog-FieldMask': 'reviews',
                    }
                })

                if (detailsResponse.ok) {
                    const detailsData = await detailsResponse.json()
                    if (detailsData.reviews) {
                        const reviewsText = detailsData.reviews.map((r: any) => r.text?.text).join('\n\n')
                        if (reviewsText) {
                            reviewsMap[place.id] = reviewsText
                        }
                    }
                }
            }))

            // Construct Batch Prompt
            // We need to ask Gemini to return a JSON object keyed by Place ID.
            if (Object.keys(reviewsMap).length > 0) {
                let prompt = `Analyze the reviews for the following cafes. For EACH cafe, identify the top 3-5 recommended dishes/drinks and count positive mentions. 
        
        Return a JSON OBJECT where the keys are the Cafe IDs and the values are arrays of dishes.
        Format:
        {
          "PLACE_ID_1": [
            { "dish_name": "Latte", "mentions": 10, "description": "Creamy and smooth" }
          ],
          ...
        }

        Cafes to analyze:
        `

                for (const place of placesToAnalyze) {
                    if (reviewsMap[place.id]) {
                        prompt += `\n\n--- Cafe ID: ${place.id} ---\nReviews:\n${reviewsMap[place.id]}`
                    }
                }

                try {
                    const response = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: prompt,
                        config: {
                            responseMimeType: "application/json"
                        }
                    });

                    const text = response.text
                    // Clean up if needed, though responseMimeType should help
                    const jsonString = text?.replace(/```json/g, '').replace(/```/g, '').trim()
                    const analysisResult = JSON.parse(jsonString || '{}')

                    // Merge results and Cache
                    for (const place of placesToAnalyze) {
                        const recommendations = analysisResult[place.id] || null

                        // Save to cache
                        if (recommendations) {
                            await supabase.from('cafe_ai_cache').upsert({
                                place_id: place.id,
                                analysis_json: recommendations,
                                last_updated: new Date().toISOString()
                            })
                        }

                        results.push({ ...place, ai_recommendations: recommendations })
                    }

                } catch (error) {
                    console.error('Gemini Batch Error:', error)
                    // Fallback: push original places without AI
                    for (const place of placesToAnalyze) {
                        results.push({ ...place, ai_recommendations: null })
                    }
                }
            } else {
                // No reviews found for any
                for (const place of placesToAnalyze) {
                    results.push({ ...place, ai_recommendations: null })
                }
            }
        }

        // Sort results to match input order
        const orderedResults = places.map(p => results.find(r => r.id === p.id) || p)

        return NextResponse.json({ places: orderedResults })

    } catch (error) {
        console.error('Analyze API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
