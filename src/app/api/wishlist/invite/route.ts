import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const { token } = await request.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role to bypass RLS for finding wishlist and adding member
    const adminSupabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find wishlist by token
    const { data: wishlist, error: fetchError } = await adminSupabase
        .from('wishlists')
        .select('id')
        .eq('share_token', token)
        .single()

    if (fetchError || !wishlist) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    // Add member
    const { error: insertError } = await adminSupabase
        .from('wishlist_members')
        .upsert({
            wishlist_id: wishlist.id,
            user_id: user.id,
            role: 'viewer'
        }, { onConflict: 'wishlist_id, user_id', ignoreDuplicates: true })

    if (insertError) {
        return NextResponse.json({ error: 'Failed to join wishlist' }, { status: 500 })
    }

    return NextResponse.json({ success: true, wishlistId: wishlist.id })
}
