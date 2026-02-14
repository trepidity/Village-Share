"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2, CornerDownLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReturnButtonProps {
  borrowId: string
}

export function ReturnButton({ borrowId }: ReturnButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleReturn = async () => {
    if (!confirm("Are you sure you want to mark this item as returned?")) {
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      // Get the borrow record to find the item
      const { data: borrow, error: fetchError } = await supabase
        .from("borrows")
        .select("id, item_id, status")
        .eq("id", borrowId)
        .single()

      if (fetchError || !borrow) {
        alert("Could not find borrow record.")
        return
      }

      if (borrow.status !== "active") {
        alert("This borrow is no longer active.")
        router.refresh()
        return
      }

      // Update borrow status to returned
      const { error: updateBorrowError } = await supabase
        .from("borrows")
        .update({
          status: "returned",
          returned_at: new Date().toISOString(),
        })
        .eq("id", borrowId)

      if (updateBorrowError) {
        alert("Failed to return item. Please try again.")
        return
      }

      // Update item status back to available
      await supabase
        .from("items")
        .update({ status: "available" })
        .eq("id", borrow.item_id)

      router.refresh()
    } catch {
      alert("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReturn}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CornerDownLeft className="h-3.5 w-3.5" />
      )}
      Return
    </Button>
  )
}
