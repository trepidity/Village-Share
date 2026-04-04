"use client"

import { useRef, useState, useEffect, useCallback, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LastIntent } from "@/lib/sms/session"

interface Message {
  id: string
  role: "user" | "bot"
  text: string
}

interface SessionState {
  activeShopId: string | null
  lastIntent: LastIntent | null
}

interface PersistedChatState {
  messages: Message[]
  session: SessionState
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
ADD [item] - add an item to your collection
REMOVE [item] - remove an item from your collection

You can also just ask me anything in plain English — I'll do my best to understand what you need.`

const STORAGE_KEY = "villageshare.chat-state"
const DEFAULT_MESSAGES: Message[] = [{ id: "greeting", role: "bot", text: GREETING }]
const DEFAULT_SESSION: SessionState = {
  activeShopId: null,
  lastIntent: null,
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [session, setSession] = useState<SessionState>(DEFAULT_SESSION)
  const [hasHydrated, setHasHydrated] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const awaitingChoice = session.lastIntent?.awaiting_choice

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setHasHydrated(true)
        return
      }

      const parsed = JSON.parse(raw) as Partial<PersistedChatState>

      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        setMessages(
          parsed.messages.filter(
            (msg): msg is Message =>
              !!msg &&
              typeof msg.id === "string" &&
              (msg.role === "user" || msg.role === "bot") &&
              typeof msg.text === "string"
          )
        )
      }

      if (parsed.session) {
        setSession({
          activeShopId:
            typeof parsed.session.activeShopId === "string"
              ? parsed.session.activeShopId
              : null,
          lastIntent:
            parsed.session.lastIntent &&
            typeof parsed.session.lastIntent === "object"
              ? parsed.session.lastIntent
              : null,
        })
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    } finally {
      setHasHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hasHydrated) return

    const payload: PersistedChatState = {
      messages,
      session,
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [hasHydrated, messages, session])

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

  async function sendMessage(text: string) {
    if (!text || isLoading) return

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

      let payload: Record<string, unknown> | null = null
      try {
        const data = (await res.json()) as unknown
        if (data && typeof data === "object") {
          payload = data as Record<string, unknown>
        }
      } catch {
        payload = null
      }

      if (payload) {
        setSession((current) => ({
          activeShopId:
            typeof payload?.activeShopId === "string"
              ? payload.activeShopId
              : payload?.activeShopId === null
                ? null
                : current.activeShopId,
          lastIntent:
            payload && "lastIntent" in payload
              ? (payload.lastIntent as LastIntent | null)
              : current.lastIntent,
        }))
      }

      const fallbackReply = !res.ok
        ? typeof payload?.error === "string"
          ? payload.error
          : "Something went wrong. Please try again."
        : "Something went wrong. Please try again."

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: "bot",
        text:
          typeof payload?.reply === "string" ? payload.reply : fallbackReply,
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
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await sendMessage(input.trim())
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
      {awaitingChoice && awaitingChoice.options && awaitingChoice.options.length > 0 && (
        <div className="border-t px-1 pt-3">
          <p className="text-sm text-muted-foreground">
            Select an option or reply with its number.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {awaitingChoice.options.map((option, index) => (
              <Button
                key={`${option.name}-${index}`}
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  void sendMessage(String(index + 1))
                }}
              >
                {index + 1}. {option.name}
              </Button>
            ))}
          </div>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="flex items-center gap-2 border-t pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] shrink-0 bg-background"
      >
        <Input
          ref={inputRef}
          name="chat-msg-nofill"
          type="search"
          inputMode="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={refocusInput}
          placeholder="Type a message..."
          readOnly={isLoading}
          autoFocus
          autoComplete="one-time-code"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-protonpass-ignore="true"
          data-form-type="other"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
