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

interface OnboardingDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function OnboardingDialog({ open, onOpenChange, onSuccess }: OnboardingDialogProps) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()

        const { error } = await supabase.auth.updateUser({
            data: { full_name: name }
        })

        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Profile updated!')
            onOpenChange(false)
            if (onSuccess) onSuccess()
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            // Prevent closing if it's forced (i.e. if we want to enforce name)
            // But for better UX, maybe allow closing? 
            // The requirement implies we "ask" them. 
            // Let's allow closing but maybe nag them? 
            // Or typically onboarding is mandatory. 
            // Let's keep it mandatory for now (disable closing via outside click if we want, but standard dialog allows it).
            // Actually, standard Dialog behavior is fine.
            onOpenChange(val)
        }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Welcome to BiteBoard!</DialogTitle>
                    <DialogDescription>
                        Please enter your name to complete your profile.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
                    <input
                        type="text"
                        placeholder="Your Name"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <Button type="submit" disabled={loading} className="w-full bg-[#4E342E] hover:bg-[#3E2723] text-[#FAF9F6]">
                        {loading ? 'Saving...' : 'Save & Continue'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
