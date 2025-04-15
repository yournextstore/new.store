'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { okaidia } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Correct style for Prism
import { ClipboardIcon, CheckIcon } from 'lucide-react'; // For copy button icon

export default function HomePage() {
  const [prompt, setPrompt] = useState('')
  const [responseJson, setResponseJson] = useState<object | null>(null)
  const [generationTime, setGenerationTime] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false) // State for copy feedback

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    setResponseJson(null)
    setGenerationTime(null)
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
      setResponseJson(data.storeJson)
      setGenerationTime(data.generationTimeMs)
    } catch (err: any) {
      setError(err.message || 'Failed to generate response')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    if (responseJson) {
      navigator.clipboard.writeText(JSON.stringify(responseJson, null, 2))
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          // Optionally show an error message to the user
        });
    }
  };

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
      <div className="border rounded-md bg-gray-50 p-4 overflow-auto flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold">API Response</h2>
            {responseJson && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="h-6 w-6" // Adjust size as needed
                aria-label="Copy JSON response"
              >
                {isCopied ? (
                  <CheckIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <ClipboardIcon className="h-4 w-4" />
                )}
              </Button>
            )}
             {isCopied && <span className="text-xs text-green-600">Copied!</span>}
          </div>
          {generationTime !== null && (
            <span className="text-sm text-gray-600">
              Generated in {(generationTime / 1000).toFixed(2)}s
            </span>
          )}
        </div>
        {isLoading && <p>Loading...</p>}
        {responseJson ? (
          <div className="flex-grow overflow-auto"> {/* Allow syntax highlighter to scroll */}
            <SyntaxHighlighter
              language="json"
              style={okaidia} // Use the correct Prism style
              customStyle={{ margin: 0, flexGrow: 1 }} // Remove default margin and allow growth
              wrapLongLines={true} // Optional: wrap long lines
            >
              {JSON.stringify(responseJson, null, 2)}
            </SyntaxHighlighter>
          </div>
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