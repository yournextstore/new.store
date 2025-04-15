'use client'

import { useState } from 'react'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { okaidia } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ClipboardIcon, CheckIcon } from 'lucide-react'

// Define the available users
const availableUsers = [
  { id: 'eLJ7gEFnW3axnIEGbMAtCSAbpiwwOhZc', name: 'gkk.dev' }
  // Add more users here later
];

export default function HomePage() {
  const [prompt, setPrompt] = useState('')
  // State for JSON response
  const [responseJson, setResponseJson] = useState<object | null>(null)
  const [storeUrl, setStoreUrl] = useState<string | null>(null); // State for store URL
  const [generationTime, setGenerationTime] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // State for copy feedback
  const [isCopied, setIsCopied] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>(availableUsers[0].id);

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    setResponseJson(null) // Reset JSON state
    setStoreUrl(null) // Reset store URL state
    setGenerationTime(null)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Send prompt and selectedUserId
        body: JSON.stringify({ prompt, userId: selectedUserId }) // <-- Send userId
      })

      if (!response.ok) {
        // Try to get more specific error details from the backend response
        const errorData = await response.json().catch(() => ({})); // Gracefully handle non-JSON error responses
        const errorMessage = errorData.details || errorData.error || response.statusText;
        throw new Error(`API Error (${response.status}): ${errorMessage}`)
      }

      const data = await response.json()
      // JSON state update
      setResponseJson(data.storeJson)
      setStoreUrl(data.storeUrl); // Set store URL state
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

        {/* User Selector */}
        <div className="space-y-2">
          <Label>Select User Account (for YNS)</Label>
          <RadioGroup
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            className="flex space-x-4"
          >
            {availableUsers.map((user) => (
              <div key={user.id} className="flex items-center space-x-2">
                <RadioGroupItem value={user.id} id={`user-${user.id}`} disabled={isLoading} />
                <Label htmlFor={`user-${user.id}`}>{user.name}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Label htmlFor="prompt-textarea">Describe the store you want to create:</Label>
        <textarea
          id="prompt-textarea"
          placeholder="Describe your store... e.g., A modern fashion store with minimalist design."
          className="w-full h-40 p-2 border rounded-md resize-none"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        />
        <div className="flex space-x-2">
          {/* Example Buttons */}
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
        <Button onClick={handleGenerate} disabled={isLoading || !prompt || !selectedUserId}>
          {isLoading ? 'Generating...' : 'Generate Store'}
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
        {isLoading && <p>Generating store...</p>}
        {responseJson ? (
          <div className="flex-grow overflow-auto mb-4"> {/* Allow syntax highlighter to scroll, add margin bottom */}
            <SyntaxHighlighter
              language="json"
              style={okaidia}
              customStyle={{ margin: 0, flexGrow: 1 }}
              wrapLongLines={true}
            >
              {JSON.stringify(responseJson, null, 2)}
            </SyntaxHighlighter>
          </div>
        ) : (
          !isLoading && !error && (
            <p className="text-gray-500">API response will appear here...</p>
          )
        )}

        {/* Display Store URL Link Below JSON */}
        {storeUrl && !isLoading && (
          <div className="mt-auto pt-4 border-t"> {/* Position at bottom, add top border */}
            <p className="font-semibold text-sm mb-1">Store Created:</p>
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {storeUrl}
            </a>
            <p className="mt-2 text-sm text-gray-600">(Store preview iframe will be added here later)</p>
          </div>
        )}

        {/* Keep iframe placeholder comment for future reference */}
        {/* Placeholder for iframe preview later
        <iframe
          src=\"about:blank\"
          title=\"Store Preview\"
          className=\"w-full h-full border-0\"
        /> */}
      </div>
    </div>
  )
} 