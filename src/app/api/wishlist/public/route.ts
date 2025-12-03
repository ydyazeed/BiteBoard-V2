import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { token } = await request.json()

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
            return NextResponse.json({ error: 'Server configuration error: Missing Service Role Key' }, { status: 500 })
        }

        // Use service role to bypass RLS for public token lookup
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Find wishlist by token - no auth required for just the title
        const { data: wishlist, error } = await supabase
            .from('wishlists')
            .select('title')
            .eq('share_token', token)
            .single()

        if (error) {
            console.error('Supabase error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!wishlist) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
        }

        return NextResponse.json({ title: wishlist.title })
    } catch (e: any) {
        console.error('Unexpected error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
