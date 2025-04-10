'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const [prompt, setPrompt] = useState('')
  const [responseJson, setResponseJson] = useState<object | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    setResponseJson(null)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`)
      }

      const data = await response.json()
      setResponseJson(data)
    } catch (err: any) {
      setError(err.message || 'Failed to generate response')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 h-screen p-4">
      {/* Left Column: Input Form */}
      <div className="flex flex-col space-y-4">
        <h1 className="text-2xl font-bold">Generate Your Store</h1>
        <p>Describe the store you want to create:</p>
        <textarea
          placeholder="Describe your store... e.g., A modern fashion store with minimalist design."
          className="w-full h-40 p-2 border rounded-md resize-none"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        />
        <div className="flex space-x-2">
          {/* TODO: Replace with actual example prompts */}
          <Button variant="outline" onClick={() => setPrompt('A modern fashion store with minimalist design.')} disabled={isLoading}>
            Fashion Store Example
          </Button>
          <Button variant="outline" onClick={() => setPrompt('An online shop selling the latest electronic gadgets.')} disabled={isLoading}>
            Electronics Store Example
          </Button>
          <Button variant="outline" onClick={() => setPrompt('A cozy store for handmade luxury candles.')} disabled={isLoading}>
            Candle Store Example
          </Button>
        </div>
        <Button onClick={handleGenerate} disabled={isLoading || !prompt}>
          {isLoading ? 'Generating...' : 'Generate'}
        </Button>

        {error && <p className="text-red-500">Error: {error}</p>}

        {/* TODO: Add toggle/switch for JSON preview */}
      </div>

      {/* Right Column: Preview Area */}
      <div className="border rounded-md bg-gray-50 p-4 overflow-auto">
        <h2 className="text-lg font-semibold mb-2">API Response</h2>
        {isLoading && <p>Loading...</p>}
        {responseJson ? (
          <pre className="text-sm whitespace-pre-wrap break-words">
            {JSON.stringify(responseJson, null, 2)}
          </pre>
        ) : (
          !isLoading && <p className="text-gray-500">API response will appear here...</p>
        )}
        {/* Placeholder for iframe preview later
        <iframe
          src="about:blank"
          title="Store Preview"
          className="w-full h-full border-0"
        /> */}
      </div>
    </div>
  )
} 