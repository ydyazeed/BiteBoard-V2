'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LoginDialog } from '@/components/LoginDialog'

export default function InvitePage() {
    const params = useParams()
    const router = useRouter()
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')
    const [loginOpen, setLoginOpen] = useState(false)
    const [wishlistTitle, setWishlistTitle] = useState<string | null>(null)

    useEffect(() => {
        const checkInvite = async () => {
            // 1. Fetch wishlist details (public)
            try {
                const publicRes = await fetch('/api/wishlist/public', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: params.token }),
                })

                if (publicRes.ok) {
                    const data = await publicRes.json()
                    setWishlistTitle(data.title)
                } else {
                    setStatus('error')
                    return
                }
            } catch (e) {
                setStatus('error')
                return
            }

            // 2. Check if user is logged in and try to join
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setLoginOpen(false) // Show landing
                setStatus('loading') // Keep loading state but show UI below
                return
            }

            // 3. If logged in, join
            try {
                const response = await fetch('/api/wishlist/invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: params.token }),
                })

                if (response.ok) {
                    setStatus('success')
                    toast.success('Joined wishlist successfully!')
                    router.push('/')
                } else {
                    setStatus('error')
                    toast.error('Invalid or expired invite link.')
                }
            } catch (error) {
                setStatus('error')
            }
        }

        checkInvite()
    }, [params.token, router])

    if (status === 'loading' && !wishlistTitle && !loginOpen) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
                <Loader2 className="h-8 w-8 animate-spin text-[#4E342E]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
            {(status === 'loading' || (wishlistTitle && status !== 'success' && status !== 'error')) && (
                <div className="flex flex-col items-center max-w-md px-6 text-center">
                    <h1 className="text-3xl font-serif text-[#4E342E] mb-2">You've been invited!</h1>
                    <p className="text-[#5D4037] mb-8 text-lg">
                        Sign up to enter <span className="font-bold text-[#4E342E]">"{wishlistTitle}"</span> wishlist.
                    </p>

                    <Button
                        onClick={() => setLoginOpen(true)}
                        size="lg"
                        className="bg-[#4E342E] text-[#FAF9F6] hover:bg-[#3E2723] w-full text-lg h-12"
                    >
                        Sign In to Join
                    </Button>
                </div>
            )}

            <LoginDialog
                open={loginOpen}
                onOpenChange={setLoginOpen}
                redirectTo={typeof window !== 'undefined' ? window.location.pathname : undefined}
            />

            {status === 'error' && (
                <div className="text-center">
                    <h1 className="text-xl font-bold text-red-500 mb-2">Error</h1>
                    <p>Could not join wishlist. Link may be expired.</p>
                    <Button className="mt-4" onClick={() => router.push('/')}>Go Home</Button>
                </div>
            )}
        </div>
    )
}
