'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { toast } from 'sonner'

interface LoginDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    redirectTo?: string
}

export function LoginDialog({ open, onOpenChange, redirectTo }: LoginDialogProps) {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [emailSent, setEmailSent] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()

        const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
        if (redirectTo) {
            callbackUrl.searchParams.set('next', redirectTo)
        }

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: callbackUrl.toString(),
            },
        })

        if (error) {
            toast.error(error.message)
        } else {
            setEmailSent(true)
            // Don't close immediately, let user see the message
        }
        setLoading(false)
    }

    const handleClose = (isOpen: boolean) => {
        if (!isOpen) {
            // Reset state when closing
            setTimeout(() => setEmailSent(false), 300)
        }
        onOpenChange(isOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{emailSent ? 'Check your email' : 'Sign in to BiteBoard'}</DialogTitle>
                    <DialogDescription>
                        {emailSent
                            ? `We've sent a login link to ${email}. Click it to sign in.`
                            : 'Enter your email to sign in or create an account.'}
                    </DialogDescription>
                </DialogHeader>

                {emailSent ? (
                    <div className="flex flex-col gap-4 mt-4">
                        <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm text-center">
                            Link sent! You can close this window.
                        </div>
                        <Button onClick={() => onOpenChange(false)} variant="outline">
                            Close
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-4">
                        <input
                            type="email"
                            placeholder="hello@example.com"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <Button type="submit" disabled={loading} className="w-full bg-[#4E342E] hover:bg-[#3E2723] text-[#FAF9F6]">
                            {loading ? 'Sending link...' : 'Send Login Link'}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
