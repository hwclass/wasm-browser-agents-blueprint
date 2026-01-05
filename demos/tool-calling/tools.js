/**
 * Tool implementations for tool-calling demo
 *
 * Available tools:
 * - count_character_occurrences: Count how many times a character appears
 * - visit_webpage: Fetch and return webpage content (mocked)
 * - search_web: Search the web (mocked)
 */

/**
 * Tool Registry
 *
 * Each tool has:
 * - name: unique identifier
 * - description: what it does
 * - parameters: JSON Schema
 * - handler: async function that executes the tool
 */

export const TOOLS = [
  {
    name: 'count_character_occurrences',
    description: 'Counts how many times a specific character appears in the given text',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to analyze'
        },
        character: {
          type: 'string',
          description: 'The character to count (single character)'
        }
      },
      required: ['text', 'character']
    },
    handler: async (args) => {
      const { text, character } = args

      if (!text || !character) {
        throw new Error('Missing required parameters: text and character')
      }

      if (character.length !== 1) {
        throw new Error('Character must be a single character')
      }

      // Count occurrences
      let count = 0
      for (const char of text) {
        if (char === character) {
          count++
        }
      }

      return {
        character,
        count,
        text_length: text.length,
        message: `The character '${character}' appears ${count} time(s) in the text.`
      }
    }
  },

  {
    name: 'visit_webpage',
    description: 'Fetches and returns the content of a webpage (mocked for demo)',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL of the webpage to visit'
        }
      },
      required: ['url']
    },
    handler: async (args) => {
      const { url } = args

      if (!url) {
        throw new Error('Missing required parameter: url')
      }

      // Mock webpage content (in production, this would use fetch)
      // Note: Real fetch would require CORS support
      const mockPages = {
        'https://example.com': {
          title: 'Example Domain',
          content: 'This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.',
          wordCount: 28
        },
        'https://mozilla.org': {
          title: 'Mozilla - Home of the Firefox browser',
          content: 'Mozilla is the maker of Firefox, the only independent browser. We champion a healthy internet for all.',
          wordCount: 22
        }
      }

      const normalizedUrl = url.toLowerCase()
      let pageData = null

      for (const [mockUrl, data] of Object.entries(mockPages)) {
        if (normalizedUrl.includes(mockUrl.replace('https://', ''))) {
          pageData = data
          break
        }
      }

      if (!pageData) {
        pageData = {
          title: 'Unknown Page',
          content: `Mock content for ${url}. In a real implementation, this would fetch actual webpage content.`,
          wordCount: 15
        }
      }

      return {
        url,
        title: pageData.title,
        content: pageData.content,
        word_count: pageData.wordCount,
        message: `Retrieved "${pageData.title}" (${pageData.wordCount} words)`
      }
    }
  },

  {
    name: 'search_web',
    description: 'Searches the web and returns relevant results (mocked for demo)',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        }
      },
      required: ['query']
    },
    handler: async (args) => {
      const { query } = args

      if (!query) {
        throw new Error('Missing required parameter: query')
      }

      // Mock search results (in production, this would use a search API)
      const mockResults = [
        {
          title: `${query} - Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${query.replace(/\s+/g, '_')}`,
          snippet: `Learn about ${query} from the free encyclopedia. Comprehensive information and references.`
        },
        {
          title: `Everything about ${query}`,
          url: `https://example.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
          snippet: `Detailed guide and resources for ${query}. Expert insights and tutorials.`
        },
        {
          title: `${query} - Latest News`,
          url: `https://news.example.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
          snippet: `Recent developments and updates about ${query}. Stay informed with the latest information.`
        }
      ]

      return {
        query,
        results: mockResults,
        count: mockResults.length,
        message: `Found ${mockResults.length} results for "${query}"`
      }
    }
  }
]

/**
 * Get tool by name
 */
export function getToolByName(name) {
  return TOOLS.find(tool => tool.name === name)
}

/**
 * Get tool schemas for LLM function calling
 */
export function getToolSchemas() {
  return TOOLS.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }))
}

/**
 * Execute a tool by name
 */
export async function executeTool(name, args) {
  const tool = getToolByName(name)

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`)
  }

  console.log(`[Tools] Executing ${name} with args:`, args)

  try {
    const result = await tool.handler(args)
    console.log(`[Tools] Result from ${name}:`, result)
    return result
  } catch (error) {
    console.error(`[Tools] Error executing ${name}:`, error)
    throw error
  }
}

/**
 * ToolExecutor implementation for runtime integration
 * Conforms to SDK ToolExecutor interface
 */
export const toolExecutor = {
  /**
   * Execute a tool with runtime metadata
   * @param {string} toolName - Name of the tool to execute
   * @param {unknown} args - Tool arguments
   * @param {object} meta - Runtime metadata (traceId, step)
   * @returns {Promise<unknown>} - Tool execution result
   */
  async execute(toolName, args, meta) {
    console.log(`[ToolExecutor] Executing ${toolName} (trace: ${meta.traceId}, step: ${meta.step})`, args)

    const tool = getToolByName(toolName)

    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`)
    }

    try {
      const result = await tool.handler(args)
      console.log(`[ToolExecutor] Result from ${toolName}:`, result)
      return result
    } catch (error) {
      console.error(`[ToolExecutor] Error executing ${toolName}:`, error)
      throw error
    }
  }
}

/**
 * Validate tool arguments against schema
 */
export function validateToolArgs(toolName, args) {
  const tool = getToolByName(toolName)

  if (!tool) {
    return { valid: false, error: `Unknown tool: ${toolName}` }
  }

  const schema = tool.parameters

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in args)) {
        return { valid: false, error: `Missing required parameter: ${field}` }
      }
    }
  }

  // Basic type checking
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in args) {
        const expectedType = propSchema.type
        const actualType = typeof args[key]

        if (expectedType === 'string' && actualType !== 'string') {
          return { valid: false, error: `Parameter ${key} must be a string` }
        }
        if (expectedType === 'number' && actualType !== 'number') {
          return { valid: false, error: `Parameter ${key} must be a number` }
        }
      }
    }
  }

  return { valid: true }
}
