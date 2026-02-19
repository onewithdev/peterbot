import { createFileRoute } from "@tanstack/react-router"
import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Loader2, ChevronUp, Send } from "lucide-react"
import { toast } from "sonner"
import { useChat } from "@/hooks/use-chat"
import { cn } from "@/lib/utils"
import type { ChatMessage, MessageGroup } from "@/types/chat"
import { groupMessagesByDate, formatMessageTime } from "@/types/chat"

export const Route = createFileRoute("/chat")({
  component: ChatPage,
})

function ChatPage() {
  const { 
    messages, 
    isLoading, 
    error, 
    hasMore, 
    loadMore, 
    isLoadingMore,
    sendMessage, 
    isSending,
  } = useChat()

  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on initial load and when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToBottom()
    }
  }, [isLoading, scrollToBottom])

  // Handle send message
  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content || isSending) return

    setInputValue("")
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    try {
      await sendMessage(content)
      // Scroll to bottom after sending
      setTimeout(scrollToBottom, 100)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    }
  }

  // Handle key press (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    
    // Auto-resize
    const textarea = e.target
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`
  }

  // Group messages by date
  const messageGroups: MessageGroup[] = groupMessagesByDate(messages)

  // Show error toast if there's an error
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load messages")
    }
  }, [error])

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          Chat
        </h1>
        <p className="text-muted-foreground">
          Two-way conversation with peterbot · synced with Telegram
        </p>
      </div>

      {/* Chat Container */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        {/* Messages Area */}
        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          <div 
            ref={chatAreaRef}
            className="flex-1 overflow-y-auto p-4 space-y-2"
          >
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  No messages yet. Start a conversation in Telegram or type below.
                </p>
              </div>
            ) : (
              <>
                {/* Load More Button */}
                {hasMore && (
                  <div className="flex justify-center py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="text-xs"
                    >
                      {isLoadingMore ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      ) : (
                        <ChevronUp className="h-3 w-3 mr-2" />
                      )}
                      Load more
                    </Button>
                  </div>
                )}

                {/* Message Groups */}
                {messageGroups.map((group) => (
                  <div key={group.label} className="space-y-1">
                    {/* Date Divider */}
                    <div className="flex justify-center py-3">
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {group.label}
                      </span>
                    </div>

                    {/* Messages in this group */}
                    {group.messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                  </div>
                ))}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t p-4 bg-card">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="min-h-[40px] max-h-[100px] resize-none flex-1"
                rows={1}
                disabled={isSending}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isSending}
                className="shrink-0 h-10"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === "user"
  const isDashboard = message.direction === "in" && message.sender === "user"
  
  // Format content - add dashboard prefix if needed
  const displayContent = isDashboard && !message.content.startsWith("📱 You (via dashboard):")
    ? message.content
    : message.content

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] sm:max-w-[70%] rounded-lg px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm border"
        )}
      >
        {/* Content */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {displayContent}
        </div>

        {/* Metadata */}
        <div
          className={cn(
            "text-xs mt-1 text-right",
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatMessageTime(message.createdAt)}
        </div>
      </div>
    </div>
  )
}
