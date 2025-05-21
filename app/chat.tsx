'use client';

import NextSteps from '@/components/next-steps';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { User } from 'better-auth';
import { useEffect, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { okaidia } from 'react-syntax-highlighter/dist/esm/styles/prism';

const Timer = () => {
  const [start, setStart] = useState(0);
  const [time, setTime] = useState(0);

  useEffect(() => {
    setStart(Date.now());
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return <>{((time - start) / 1000).toFixed(2)}s</>;
};

// Define the available users
const availableUsers = [
  { id: 'eLJ7gEFnW3axnIEGbMAtCSAbpiwwOhZc', name: 'gkk.dev' },
  // Add more users here later
];

// Define the generation modes type with specific backend identifiers
type GenerationMode =
  | 'stock'
  | 'getimg.ai'
  | 'fal.ai-flux-1.1-pro'
  | 'openai-gpt-image-1';

export const ChatInner = ({ user }: { user: User }) => {
  const [activeTab, setActiveTab] = useState('preview');
  const [prompt, setPrompt] = useState('');
  // State for image generation mode
  const [imageGenerationMode, setImageGenerationMode] =
    useState<GenerationMode>('fal.ai-flux-1.1-pro');
  // State for JSON response
  const [responseJson, setResponseJson] = useState<object | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null); // State for store URL
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State for copy feedback
  const [isCopied, setIsCopied] = useState(false);

  // New states for progressive feedback
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [heroPreview, setHeroPreview] = useState<{
    heroTitle?: string;
    heroDescription?: string;
  } | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setResponseJson(null);
    setStoreUrl(null);
    setGenerationTime(null);
    setCurrentJobId(null);
    setJobStatus(null);
    setHeroPreview(null);

    const newJobId = crypto.randomUUID();
    setCurrentJobId(newJobId);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send prompt, userId, imageGenerationMode, and jobId
        body: JSON.stringify({
          prompt,
          userId: user.id,
          imageGenerationMode,
          jobId: newJobId,
        }),
      });

      if (!response.ok) {
        // Try to get more specific error details from the backend response
        const errorData = await response.json().catch(() => ({})); // Gracefully handle non-JSON error responses
        const errorMessage =
          errorData.details || errorData.error || response.statusText;
        throw new Error(`API Error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json();
      // JSON state update
      setResponseJson(data.storeJson);
      setStoreUrl(data.storeUrl); // Set store URL state
      setGenerationTime(data.generationTimeMs);
      // If POST completes successfully, we can assume full_ready if not already set by polling
      if (jobStatus !== 'full_ready') {
        setJobStatus('full_ready');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate response');
      setJobStatus('failed');
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect for polling job status
  useEffect(() => {
    if (!currentJobId) {
      setJobStatus(null);
      setHeroPreview(null);
      return;
    }

    if (jobStatus === 'full_ready' || jobStatus === 'failed') {
      return;
    }

    // Optimistically set to 'queued' if not already set and a job ID exists
    if (!jobStatus && currentJobId) {
      setJobStatus('queued');
    }

    const pollingInterval = 1000; // 1 second

    const intervalId = setInterval(async () => {
      try {
        const statusResponse = await fetch(
          `/api/generate/${currentJobId}/status`,
        );
        if (!statusResponse.ok) {
          console.error(
            `Polling error: ${statusResponse.status} for job ${currentJobId}`,
          );
          // If 404 and we are in 'queued', it might just be a delay, so we don't update status yet.
          // For other errors, or persistent 404, we might want to set a specific error or stop.
          // For simplicity now, we let it continue polling unless a terminal state is reached.
          if (statusResponse.status === 404 && jobStatus === 'queued') {
            return;
          }
          // Optionally: if many errors, stop polling or set jobStatus to a polling_error state
          return;
        }

        const statusData = await statusResponse.json();

        if (statusData.status !== jobStatus) {
          setJobStatus(statusData.status);
        }

        if (statusData.status === 'hero_ready' && statusData.hero_json) {
          setHeroPreview({
            heroTitle: statusData.hero_json.heroTitle,
            heroDescription: statusData.hero_json.heroDescription,
          });
        } else if (statusData.status !== 'hero_ready') {
          // Clear hero preview if not in hero_ready state anymore (e.g. progresses to full_ready)
          // setHeroPreview(null); // Decided against this for now to keep hero info visible if it was shown
        }

        if (
          statusData.status === 'full_ready' ||
          statusData.status === 'failed'
        ) {
          clearInterval(intervalId);
          if (
            statusData.status === 'failed' &&
            statusData.error_msg &&
            !error
          ) {
            setError(statusData.error_msg); // Set error from polling if not already set by main request
          }
          // If main request already finished and set isLoading to false,
          // but polling reaches terminal state later, ensure loading is false.
          if (isLoading) {
            setIsLoading(false);
          }
        }
      } catch (pollError: any) {
        console.error('Error during polling request:', pollError);
      }
    }, pollingInterval);

    return () => clearInterval(intervalId);
  }, [currentJobId, jobStatus, error, isLoading]); // Added isLoading to deps for the final check inside interval

  const handleCopy = () => {
    if (responseJson) {
      navigator.clipboard
        .writeText(JSON.stringify(responseJson, null, 2))
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        })
        .catch((err) => {
          console.error('Failed to copy text: ', err);
          // Optionally show an error message to the user
        });
    }
  };

  return (
    <div className="grid grid-cols-6 gap-4 h-screen px-4">
      {/* Left Column: Input Form */}
      <div className="flex flex-col space-y-4 col-span-2 h-full py-2">
        <h1 className="text-2xl font-bold">
          Generate Your Next Store
          <p className="text-sm font-semibold">
            Logged in as {user.name} ({user.email})
          </p>
        </h1>

        <textarea
          id="prompt-textarea"
          placeholder="Describe your store... e.g., A modern fashion store with minimalist design."
          className="w-full h-40 p-2 border rounded-md resize-none"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        />
        {/* Replace Tabs with RadioGroup for mode selection */}
        <div className="mb-4">
          <Label className="text-sm font-medium mb-2 block">
            Image Generation Mode
          </Label>
          <RadioGroup
            value={imageGenerationMode}
            onValueChange={(value) =>
              setImageGenerationMode(value as GenerationMode)
            }
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="stock" id="mode-stock" />
              <Label htmlFor="mode-stock" className="text-sm font-normal">
                Stock Images
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="getimg.ai" id="mode-getimg" />
              <Label htmlFor="mode-getimg" className="text-sm font-normal">
                Generate (GetImg)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fal.ai-flux-1.1-pro" id="mode-falai" />
              <Label htmlFor="mode-falai" className="text-sm font-normal">
                Generate (Fal AI)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="openai-gpt-image-1" id="mode-openai" />
              <Label htmlFor="mode-openai" className="text-sm font-normal">
                Generate (OpenAI)
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Example Buttons */}
          <Button
            variant="outline"
            onClick={() =>
              setPrompt(
                'Minimalist shoes designed for everyday comfort, style, and motion.',
              )
            }
            disabled={isLoading}
          >
            Minimalist Shoes Store Example
          </Button>
          {/* <Button
            variant="outline"
            onClick={() =>
              setPrompt('A modern fashion store with minimalist design.')
            }
            disabled={isLoading}
          >
            Fashion Store Example
          </Button>
          */}
          <Button
            variant="outline"
            onClick={() =>
              setPrompt('An online shop selling the latest electronic gadgets.')
            }
            disabled={isLoading}
          >
            Electronics Store Example
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setPrompt('A cozy store for handmade luxury candles.')
            }
            disabled={isLoading}
          >
            Candle Store Example
          </Button>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isLoading || !prompt}
          className="rounded-full"
        >
          {isLoading ? 'Generating...' : 'Generate Your Store'}
        </Button>

        {error && <p className="text-red-500">Error: {error}</p>}

        <div className="mt-16">{storeUrl && <NextSteps />}</div>

        {/* TODO: Add toggle/switch for JSON preview */}
        <footer className="mt-auto text-xs py-2">
          <a
            href={`${process.env.NEXT_PUBLIC_YNS_API_URL}/login`}
            target="_blank"
            className="hover:underline"
          >
            {process.env.NEXT_PUBLIC_YNS_API_URL}
          </a>
        </footer>
      </div>

      {/* Right Column: Preview Area */}
      <div className="col-span-4 min-h-full flex flex-col py-2">
        <Tabs
          defaultValue="preview"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex flex-1 flex-col"
        >
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="json">JSON Output</TabsTrigger>
            </TabsList>
            {isLoading && (
              <span className="text-sm text-gray-600">
                Generating store... <Timer />
              </span>
            )}
            {generationTime !== null &&
              !isLoading && ( // Show generation time only when not loading
                <span className="text-sm text-gray-600">
                  Generated in {(generationTime / 1000).toFixed(2)}s
                </span>
              )}
          </div>
          {/* New Status Display Area Start - Placed below the timer/gen time */}
          {currentJobId &&
            jobStatus &&
            jobStatus !== 'full_ready' &&
            isLoading && (
              <div className="my-2 p-3 border rounded-md bg-gray-100 text-sm text-gray-800 shadow-sm">
                <p className="font-semibold">
                  Progress (Job: {currentJobId.substring(0, 8)}...):{' '}
                  <span className="font-mono bg-gray-200 px-1 rounded">
                    {jobStatus}
                  </span>
                </p>
                {jobStatus === 'hero_ready' && heroPreview && (
                  <div className="mt-1 pt-1 pl-2 border-l-2 border-gray-300">
                    {heroPreview.heroTitle && (
                      <p className="text-xs">
                        <span className="font-medium">Hero Title:</span>{' '}
                        {heroPreview.heroTitle}
                      </p>
                    )}
                    {heroPreview.heroDescription && (
                      <p className="text-xs">
                        <span className="font-medium">Hero Desc:</span>{' '}
                        {heroPreview.heroDescription}
                      </p>
                    )}
                    <p className="text-xs italic mt-1 text-gray-600">
                      Full store generation in progress...
                    </p>
                  </div>
                )}
                {jobStatus === 'queued' && (
                  <p className="text-xs italic text-gray-600">
                    Waiting for processing to start...
                  </p>
                )}
                {jobStatus === 'failed' && error && (
                  <p className="text-xs text-red-600">Error: {error}</p>
                )}
              </div>
            )}
          {/* New Status Display Area End */}
          <div className="border rounded-md bg-gray-50 overflow-auto flex flex-col flex-1 mt-2">
            {' '}
            {/* Added mt-2 for spacing */}
            <TabsContent value="json">
              {responseJson ? (
                <div className="grow overflow-auto mb-4">
                  {' '}
                  {/* Allow syntax highlighter to scroll, add margin bottom */}
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
                !isLoading &&
                !error && (
                  <p className="text-gray-500">
                    API response will appear here...
                  </p>
                )
              )}
            </TabsContent>
            {/* Display Store URL Link Below JSON */}
            <TabsContent value="preview" className="flex flex-col flex-1">
              {storeUrl ? (
                <>
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-600 px-8 py-1 hover:underline break-all flex"
                  >
                    {storeUrl}
                  </a>
                  <div className="border-t flex-1 flex h-full">
                    <iframe
                      src={storeUrl}
                      title="Store Preview"
                      className="w-full flex-1 border-0"
                    />
                  </div>
                </>
              ) : (
                !isLoading &&
                !error && (
                  <p className="text-gray-500">
                    Your ready to use store will appear here
                  </p>
                )
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};
