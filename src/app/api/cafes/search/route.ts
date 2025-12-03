import { NextResponse } from 'next/server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

export async function POST(request: Request) {
    try {
        const { lat, lng, pageToken } = await request.json()

        if ((!lat || !lng) && !pageToken) {
            return NextResponse.json({ error: 'Latitude and Longitude are required' }, { status: 400 })
        }

        const placesUrl = `https://places.googleapis.com/v1/places:searchNearby`
        const requestBody: any = {
            includedTypes: ['cafe', 'coffee_shop'],
            maxResultCount: 20,
            locationRestriction: {
                circle: {
                    center: {
                        latitude: lat,
                        longitude: lng,
                    },
                    radius: 5000.0, // 5km
                },
            },
        }

        // Note: searchNearby does not support pageToken in the same way as Text Search (New). 
        // It uses strict restrictions. 
        // Wait, the new Places API (v1) does not support next_page_token for searchNearby?
        // Let's check the docs provided or general knowledge.
        // "The response includes a next_page_token if there are more results."
        // But for the REQUEST, we don't pass pageToken to searchNearby?
        // Actually, v1 searchNearby DOES NOT support pagination in the same way as the old API or textSearch.
        // "searchNearby" is for strict nearby. "textSearch" is better for "cafes near me" with pagination.
        // However, the user linked https://developers.google.com/maps/documentation/places/web-service/overview
        // Let's switch to `places:searchText` which definitely supports pagination and is often better for "cafes".
        // Query: "cafes"

        // Let's use `searchText` for better pagination support.

        const searchUrl = `https://places.googleapis.com/v1/places:searchText`
        const searchBody: any = {
            textQuery: "cafe",
            maxResultCount: 20,
            minRating: 4.0, // Filter by rating directly if supported? 
            // v1 searchText supports minRating!
            locationBias: {
                circle: {
                    center: { latitude: lat, longitude: lng },
                    radius: 5000.0
                }
            }
        }

        // If pageToken exists, we might need to use it. 
        // But wait, v1 searchText uses `pageToken` in the body? No, it's `pageToken` parameter?
        // Actually, for v1, it's not `pageToken`, it's just handled differently?
        // Checking docs... "pageToken" field in the request body.
        if (pageToken) {
            // If pageToken is provided, other parameters are ignored usually, but let's include them or just the token.
            // Usually just the token is enough for the next page.
            // But for v1, we put it in the body.
            delete searchBody.textQuery
            delete searchBody.locationBias
            delete searchBody.minRating
            searchBody.pageToken = pageToken
        }

        const response = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.rating,places.userRatingCount,nextPageToken',
            },
            body: JSON.stringify(searchBody),
        })

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Places API Error:', errorText);
            return NextResponse.json({ error: 'Failed to fetch places', details: errorText }, { status: 500 });
        }

        const data = await response.json()

        // Filter by rating just in case API didn't do it strictly or if we want to be sure
        // (Though minRating in request should handle it)
        const places = data.places || []
        const filteredPlaces = places.filter((p: any) => p.rating >= 4.0)

        return NextResponse.json({
            places: filteredPlaces,
            nextPageToken: data.nextPageToken
        })

    } catch (error) {
        console.error('Search API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
