"use client"

import { useRef, useState, useEffect, useCallback, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "bot"
  text: string
}

interface SessionState {
  activeShopId: string | null
  lastIntent: unknown
}

const GREETING = `Welcome to VillageShare!

Here are some things you can do:

BORROW [item] - borrow an item
RETURN [item] - return an item
SEARCH [term] - find items
WHERE IS [item] - find an item's location
WHO HAS [item] - see who borrowed it
RESERVE [item] for [date] - book ahead
STATUS - see your active borrows
CANCEL [item] - cancel a reservation
ADD [item] - add an item to your shop
REMOVE [item] - remove an item from your shop

You can also just ask me anything in plain English — I'll do my best to understand what you need.`

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "greeting", role: "bot", text: GREETING },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [session, setSession] = useState<SessionState>({
    activeShopId: null,
    lastIntent: null,
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages])

  // Keep input visible when mobile keyboard opens
  useEffect(() => {
    const handleResize = () => {
      // visualViewport shrinks when keyboard opens; scroll input into view
      inputRef.current?.scrollIntoView({ block: "nearest" })
    }
    window.visualViewport?.addEventListener("resize", handleResize)
    return () => window.visualViewport?.removeEventListener("resize", handleResize)
  }, [])

  // Re-focus input whenever it loses focus (e.g. tapping messages area)
  const refocusInput = useCallback(() => {
    // Small delay so any click/tap completes before we grab focus
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          activeShopId: session.activeShopId,
          lastIntent: session.lastIntent,
        }),
      })

      const data = await res.json()

      setSession({
        activeShopId: data.activeShopId ?? session.activeShopId,
        lastIntent: data.lastIntent ?? null,
      })

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: "bot",
        text: data.reply ?? "Something went wrong. Please try again.",
      }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "bot",
          text: "Could not reach the server. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-6rem)] max-w-2xl mx-auto">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3 py-4 px-1"
        onClick={refocusInput}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input area — sticky with safe-area padding for mobile keyboards */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] shrink-0 bg-background"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={refocusInput}
          placeholder="Type a message..."
          disabled={isLoading}
          autoFocus
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
