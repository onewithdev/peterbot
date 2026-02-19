import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { 
  ChatMessagesResponse, 
  ApiChatMessage, 
  SendMessageRequest, 
  SendMessageResponse,
  ChatMessage,
} from '@/types/chat'
import { mapApiMessageToMessage } from '@/types/chat'

const POLL_INTERVAL = 5000 // 5 seconds
const QUERY_KEY = ['chat-messages']

interface UseChatOptions {
  enabled?: boolean
}

/**
 * Hook for managing chat messages with polling and optimistic updates.
 * 
 * Features:
 * - Initial load of last N messages
 * - Incremental polling every 5 seconds using `since` parameter
 * - Load more (older) messages using `before` parameter
 * - Optimistic insert on send (using real DB ID from response)
 * - Auto-scroll support
 */
export function useChat(options: UseChatOptions = {}) {
  const { enabled = true } = options
  const queryClient = useQueryClient()
  
  // Track the timestamp of the newest message for polling
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<number | null>(null)
  
  // Track the timestamp of the oldest message for load-more
  const [oldestMessageTimestamp, setOldestMessageTimestamp] = useState<number | null>(null)
  
  // Track if there are more messages to load
  const [hasMore, setHasMore] = useState(true)
  
  // Ref to prevent duplicate polling requests
  const isPollingRef = useRef(false)

  // ========================================================================
  // Initial Load Query
  // ========================================================================
  const { 
    data: initialData, 
    isLoading: isInitialLoading, 
    error: initialError,
  } = useQuery<ChatMessagesResponse>({
    queryKey: [...QUERY_KEY, 'initial'],
    queryFn: async () => {
      const response = await api.chat.messages.$get({
        query: { limit: '50' },
      })
      if (!response.ok) {
        throw new Error('Failed to load messages')
      }
      return response.json()
    },
    enabled,
    staleTime: Infinity, // We manage updates via polling
  })

  // Initialize timestamps when initial data loads
  useEffect(() => {
    if (initialData?.messages && initialData.messages.length > 0) {
      const messages = initialData.messages
      const newest = new Date(messages[messages.length - 1].createdAt).getTime()
      const oldest = new Date(messages[0].createdAt).getTime()
      setLastMessageTimestamp(newest)
      setOldestMessageTimestamp(oldest)
      setHasMore(messages.length === 50)
    } else if (initialData?.messages) {
      setHasMore(false)
    }
  }, [initialData])

  // ========================================================================
  // Polling Effect (every 5 seconds)
  // ========================================================================
  useEffect(() => {
    if (!enabled || !lastMessageTimestamp) return

    const poll = async () => {
      if (isPollingRef.current) return
      isPollingRef.current = true

      try {
        const response = await api.chat.messages.$get({
          query: { since: lastMessageTimestamp.toString() },
        })
        
        if (response.ok) {
          const data: ChatMessagesResponse = await response.json()
          
          if (data.messages.length > 0) {
            // Get current messages from cache
            const currentData = queryClient.getQueryData<ChatMessagesResponse>([...QUERY_KEY, 'initial'])
            
            if (currentData) {
              // Merge new messages, avoiding duplicates by ID
              const existingIds = new Set(currentData.messages.map(m => m.id))
              const newMessages = data.messages.filter(m => !existingIds.has(m.id))
              
              if (newMessages.length > 0) {
                queryClient.setQueryData<ChatMessagesResponse>([...QUERY_KEY, 'initial'], {
                  messages: [...currentData.messages, ...newMessages],
                })
                
                // Update last message timestamp
                const newest = new Date(newMessages[newMessages.length - 1].createdAt).getTime()
                setLastMessageTimestamp(newest)
              }
            }
          }
        }
      } catch (err) {
        console.error('[chat] poll error:', err)
      } finally {
        isPollingRef.current = false
      }
    }

    const intervalId = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(intervalId)
  }, [enabled, lastMessageTimestamp, queryClient])

  // ========================================================================
  // Load More (older messages)
  // ========================================================================
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null)

  const loadMore = useCallback(async () => {
    if (!oldestMessageTimestamp || isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    setLoadMoreError(null)

    try {
      const response = await api.chat.messages.$get({
        query: { 
          before: oldestMessageTimestamp.toString(),
          limit: '50',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load more messages')
      }

      const data: ChatMessagesResponse = await response.json()
      
      // Get current messages from cache
      const currentData = queryClient.getQueryData<ChatMessagesResponse>([...QUERY_KEY, 'initial'])
      
      if (currentData) {
        // Prepend older messages
        queryClient.setQueryData<ChatMessagesResponse>([...QUERY_KEY, 'initial'], {
          messages: [...data.messages, ...currentData.messages],
        })

        // Update oldest timestamp
        if (data.messages.length > 0) {
          const oldest = new Date(data.messages[0].createdAt).getTime()
          setOldestMessageTimestamp(oldest)
        }
        
        // Check if there might be more messages
        setHasMore(data.messages.length === 50)
      }
    } catch (err) {
      setLoadMoreError(err instanceof Error ? err : new Error('Failed to load more'))
    } finally {
      setIsLoadingMore(false)
    }
  }, [oldestMessageTimestamp, isLoadingMore, hasMore, queryClient])

  // ========================================================================
  // Send Message Mutation (with optimistic update)
  // ========================================================================
  const sendMutation = useMutation({
    mutationFn: async (content: string): Promise<SendMessageResponse> => {
      const response = await api.chat.send.$post({
        json: { content } as SendMessageRequest,
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to send message')
      }
      
      return response.json()
    },
    onMutate: async (content: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [...QUERY_KEY, 'initial'] })

      // Snapshot previous value
      const previousData = queryClient.getQueryData<ChatMessagesResponse>([...QUERY_KEY, 'initial'])

      // Optimistically add a temporary message
      if (previousData) {
        const tempMessage: ApiChatMessage = {
          id: `temp-${Date.now()}`,
          chatId: '',
          direction: 'in',
          content,
          sender: 'user',
          jobId: null,
          createdAt: new Date().toISOString(),
        }

        queryClient.setQueryData<ChatMessagesResponse>([...QUERY_KEY, 'initial'], {
          messages: [...previousData.messages, tempMessage],
        })
      }

      return { previousData }
    },
    onSuccess: (data, content, _context) => {
      // Replace temporary message with real one from server
      const currentData = queryClient.getQueryData<ChatMessagesResponse>([...QUERY_KEY, 'initial'])
      
      if (currentData) {
        const realMessage: ApiChatMessage = {
          id: data.messageId,
          chatId: '',
          direction: 'in',
          content,
          sender: 'user',
          jobId: null,
          createdAt: new Date(data.createdAt).toISOString(),
        }

        queryClient.setQueryData<ChatMessagesResponse>([...QUERY_KEY, 'initial'], {
          messages: currentData.messages.map(m => 
            m.id.startsWith('temp-') && m.content === content ? realMessage : m
          ),
        })

        // Update last message timestamp
        setLastMessageTimestamp(data.createdAt)
      }
    },
    onError: (_err, _content, context) => {
      // Revert to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData([...QUERY_KEY, 'initial'], context.previousData)
      }
    },
  })

  // ========================================================================
  // Derived State
  // ========================================================================
  const messages: ChatMessage[] = initialData?.messages.map(mapApiMessageToMessage) ?? []
  const isLoading = isInitialLoading
  const error = initialError ?? loadMoreError
  const isSending = sendMutation.isPending

  return {
    messages,
    isLoading,
    error,
    hasMore,
    loadMore,
    isLoadingMore,
    sendMessage: sendMutation.mutateAsync,
    isSending,
  }
}

export type UseChatReturn = ReturnType<typeof useChat>
