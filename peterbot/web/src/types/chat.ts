import type { ChatMessage as ChatMessageSchema } from '../../../src/features/chat/schema'

// ChatMessage type from the database schema (with Date objects)
export type ChatMessage = ChatMessageSchema

// API returns dates as strings (JSON serialization)
export interface ApiChatMessage {
  id: string
  chatId: string
  direction: 'in' | 'out'
  content: string
  sender: 'user' | 'bot'
  jobId: string | null
  createdAt: string
}

export interface ChatMessagesResponse {
  messages: ApiChatMessage[]
}

export interface SendMessageRequest {
  content: string
}

export interface SendMessageResponse {
  messageId: string
  createdAt: number
}

// Helper function to convert API message to ChatMessage (converts string dates to Date objects)
export function mapApiMessageToMessage(apiMessage: ApiChatMessage): ChatMessage {
  return {
    ...apiMessage,
    createdAt: new Date(apiMessage.createdAt),
  } as ChatMessage
}

// Helper function to convert ChatMessage to API message (converts Date objects to strings)
export function mapMessageToApiMessage(message: ChatMessage): ApiChatMessage {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  }
}

// Group messages by date for display
export interface MessageGroup {
  label: string
  messages: ChatMessage[]
}

/**
 * Group messages by date (Today, Yesterday, or specific date)
 */
export function groupMessagesByDate(messages: ChatMessage[]): MessageGroup[] {
  const groups: Map<string, ChatMessage[]> = new Map()
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  for (const message of messages) {
    const messageDate = new Date(message.createdAt)
    messageDate.setHours(0, 0, 0, 0)
    
    let label: string
    if (messageDate.getTime() === today.getTime()) {
      label = 'Today'
    } else if (messageDate.getTime() === yesterday.getTime()) {
      label = 'Yesterday'
    } else {
      label = messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      })
    }
    
    if (!groups.has(label)) {
      groups.set(label, [])
    }
    groups.get(label)!.push(message)
  }
  
  // Convert to array preserving chronological order
  return Array.from(groups.entries()).map(([label, msgs]) => ({
    label,
    messages: msgs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  }))
}

/**
 * Format time for display in chat bubbles
 */
export function formatMessageTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
