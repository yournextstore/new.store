'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenerationJobStatus } from '@/lib/generation-job-tracker';

// Placeholder type for heroData - replace with actual structure from API's hero_json
export interface HeroData {
  title?: string; // For the main hero heading
  description?: string; // For the hero paragraph
  buttonLabel?: string; // For the call-to-action button's text
  imageUrl?: string; // For the hero image source URL
  imageAltText?: string; // For the hero image's alt text
}

interface StoreGenerationProgressProps {
  jobStatus: GenerationJobStatus | null;
  heroData: HeroData | null;
  errorMsg?: string | null;
  className?: string;
  // onComplete is handled by the parent component (app/chat.tsx) observing jobStatus
}

// Corresponds to GenerationJobStatus, used for display and step logic
const STATUS_STEP_MAP: Record<
  GenerationJobStatus,
  { index: number; label: string }
> = {
  queued: { index: 0, label: 'Preparing your request' },
  hero_ready: { index: 1, label: 'Generating hero section' },
  store_skeleton_ready: { index: 2, label: 'Building store structure' },
  image_processing: { index: 3, label: 'Processing images' },
  images_resolved: { index: 4, label: 'Finalizing content' },
  store_ready: { index: 5, label: 'Store is ready!' }, // This state typically means the component is hidden
  failed: { index: 6, label: 'Generation failed' }, // This state also means component might be hidden or show error
};

const TOTAL_VISIBLE_STEPS = 5; // Number of steps before 'store_ready' or 'failed'

export function StoreGenerationProgress({
  jobStatus,
  heroData,
  errorMsg,
  className,
}: StoreGenerationProgressProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentStepLabel, setCurrentStepLabel] = useState('Starting...');
  const [isTerminalState, setIsTerminalState] = useState(false);

  const displaySteps = [
    STATUS_STEP_MAP.queued,
    STATUS_STEP_MAP.hero_ready,
    STATUS_STEP_MAP.store_skeleton_ready,
    STATUS_STEP_MAP.image_processing,
    STATUS_STEP_MAP.images_resolved,
  ];

  useEffect(() => {
    if (!jobStatus) {
      setCurrentStepIndex(0);
      setIsTerminalState(false);
      return;
    }

    const statusInfo = STATUS_STEP_MAP[jobStatus];
    let newActiveStepIndex = statusInfo.index;

    if (jobStatus === 'hero_ready') {
      newActiveStepIndex = STATUS_STEP_MAP.store_skeleton_ready.index;
    } else if (jobStatus === 'store_skeleton_ready') {
      newActiveStepIndex = STATUS_STEP_MAP.image_processing.index;
    }

    setCurrentStepIndex(newActiveStepIndex);

    if (newActiveStepIndex <= TOTAL_VISIBLE_STEPS) {
      const activeDisplayStep = displaySteps.find(
        (step) => step.index === newActiveStepIndex,
      );
      if (activeDisplayStep) {
        setCurrentStepLabel(activeDisplayStep.label);
      }
    } else if (jobStatus === 'store_ready' || jobStatus === 'failed') {
      setCurrentStepLabel(statusInfo.label);
    }

    if (jobStatus === 'store_ready' || jobStatus === 'failed') {
      setIsTerminalState(true);
    } else {
      setIsTerminalState(false);
    }
  }, [jobStatus]);

  // This component might be unmounted by parent on store_ready/failed, but if not, it can show a final state.
  if (!jobStatus) {
    return null; // Or a minimal loader if preferred when status is unknown initially
  }

  const isCompletedSuccessfully = jobStatus === 'store_ready';

  return (
    <div
      className={cn(
        'w-full max-w-md mx-auto p-6 rounded-lg border shadow-sm bg-background',
        className,
      )}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-center">
          {isTerminalState &&
          !isCompletedSuccessfully &&
          jobStatus === 'failed' ? (
            <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          ) : isCompletedSuccessfully ? (
            <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          )}
        </div>

        {/* Preview Section */}
        <div className="w-full h-48 bg-muted/30 rounded-lg border overflow-hidden">
          {jobStatus === 'failed' && errorMsg ? (
            <div className="w-full h-full p-4 flex flex-col items-center justify-center text-center">
              <h3 className="font-semibold text-red-600">Generation Failed</h3>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            </div>
          ) : heroData &&
            currentStepIndex >= STATUS_STEP_MAP.hero_ready.index ? (
            <HeroSectionPreviewV0 heroData={heroData} />
          ) : (
            <>
              {currentStepIndex === STATUS_STEP_MAP.queued.index && (
                <StoreGenerationPreviewV0 />
              )}
              {
                currentStepIndex === STATUS_STEP_MAP.hero_ready.index && (
                  <HeroSectionPreviewV0 />
                ) /* Show placeholder until heroData arrives */
              }
              {
                currentStepIndex ===
                  STATUS_STEP_MAP.store_skeleton_ready.index && (
                  <ProductGenerationPreviewV0 statusText="Building store structure..." />
                ) /* Or a new specific preview */
              }
              {currentStepIndex === STATUS_STEP_MAP.image_processing.index && (
                <ProductGenerationPreviewV0 statusText="Processing images..." />
              )}
              {currentStepIndex === STATUS_STEP_MAP.images_resolved.index && (
                <FinalizeStorePreviewV0 />
              )}
              {/* store_ready is typically handled by parent hiding this component */}
            </>
          )}
        </div>

        <div className="space-y-4">
          {displaySteps.map((step) => (
            <div key={step.index} className="space-y-2">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0',
                    step.index < currentStepIndex
                      ? 'bg-green-500 text-white'
                      : step.index === currentStepIndex && !isTerminalState
                        ? 'bg-primary text-primary-foreground'
                        : jobStatus === 'failed' &&
                            step.index === currentStepIndex
                          ? 'bg-red-500 text-white'
                          : 'bg-muted text-muted-foreground',
                  )}
                >
                  {step.index < currentStepIndex &&
                  !(
                    jobStatus === 'failed' && step.index === currentStepIndex
                  ) ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : jobStatus === 'failed' &&
                    step.index === currentStepIndex ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    step.index + 1
                  )}
                </div>
                <div
                  className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    step.index === currentStepIndex && !isTerminalState
                      ? 'text-foreground'
                      : step.index < currentStepIndex &&
                          !(
                            jobStatus === 'failed' &&
                            step.index === currentStepIndex
                          )
                        ? 'text-muted-foreground line-through'
                        : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </div>
              </div>

              {step.index < displaySteps.length - 1 && (
                <div className="ml-3 pl-[10px] border-l h-4 border-muted" />
              )}
            </div>
          ))}
        </div>

        {jobStatus !== 'failed' && (
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 ease-in-out',
                isCompletedSuccessfully ? 'bg-green-500' : 'bg-primary',
              )}
              style={{
                width: isCompletedSuccessfully
                  ? '100%'
                  : `${(currentStepIndex / TOTAL_VISIBLE_STEPS) * 100}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper Preview Components (adapted from v0 mockup) ---
// Renamed with V0 suffix to avoid potential naming conflicts if similar components exist.

// Step 1: Store Generation Preview (for 'queued')
function StoreGenerationPreviewV0() {
  return (
    <div className="w-full h-full p-4 flex flex-col animate-pulse">
      <div className="h-6 bg-gray-200 rounded-md w-3/4 mb-4 animate-[pulse_2s_ease-in-out_infinite]" />
      <div className="flex space-x-2 mb-4">
        {[1, 2, 3, 4].map((itemKey) => (
          <div
            key={itemKey}
            className="h-4 bg-gray-200 rounded-md w-16 animate-[pulse_2s_ease-in-out_infinite]"
            style={{ animationDelay: `${itemKey * 0.1}s` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 flex-grow">
        {[1, 2, 3, 4].map((itemKey) => (
          <div
            key={itemKey}
            className="flex flex-col space-y-2 opacity-0 animate-[fadeIn_2s_forwards]"
            style={{ animationDelay: `${itemKey * 0.5}s` }}
          >
            <div className="h-16 bg-gray-200 rounded-md" />
            <div className="h-3 bg-gray-200 rounded-md w-3/4" />
            <div className="h-3 bg-gray-200 rounded-md w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Step 2: Hero Section Preview (for 'hero_ready')
function HeroSectionPreviewV0({ heroData }: { heroData?: HeroData }) {
  if (heroData) {
    // Use direct properties from the simplified HeroData interface
    const title = heroData.title;
    const description = heroData.description;
    const ctaLabel = heroData.buttonLabel || 'Shop Soon'; // Default if not provided
    const imageUrl = heroData.imageUrl;
    const imageAlt = heroData.imageAltText || heroData.title || 'Hero image'; // Default alt to title or generic

    return (
      <div className="w-full h-full relative overflow-hidden animate-[fadeIn_0.5s_forwards]">
        <div className="w-full h-full bg-gradient-to-r from-blue-100 via-indigo-50 to-purple-100 p-4 flex items-center justify-between">
          <div className="space-y-2 max-w-[60%]">
            <h2
              className="font-bold text-lg text-gray-800 truncate"
              title={title}
            >
              {title}
            </h2>
            <p
              className="text-sm text-gray-700 line-clamp-2"
              title={description}
            >
              {description}
            </p>
            <button
              type="button"
              className="mt-2 px-4 py-1 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
            >
              {ctaLabel}
            </button>
          </div>
          {imageUrl && (
            <div className="h-24 w-24 rounded-md overflow-hidden shrink-0 ml-2">
              <img
                src={imageUrl}
                alt={imageAlt}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            </div>
          )}
        </div>
        <div className="absolute top-2 right-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-full backdrop-blur-sm">
          Hero Preview
        </div>
      </div>
    );
  }

  // Placeholder animation if heroData is not yet available but status is hero_ready
  return (
    <div className="w-full h-full p-4 flex flex-col animate-pulse">
      <div className="w-full h-32 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg mb-4 relative overflow-hidden">
        <div
          className="absolute top-4 left-4 h-6 w-32 bg-gray-300 rounded-md opacity-70 animate-[pulse_1.5s_ease-in-out_infinite]"
          style={{ animationDelay: '0.1s' }}
        />
        <div
          className="absolute top-12 left-4 h-4 w-48 bg-gray-300 rounded-md opacity-70 animate-[pulse_1.5s_ease-in-out_infinite]"
          style={{ animationDelay: '0.2s' }}
        />
        <div
          className="absolute top-20 left-4 h-4 w-24 bg-gray-300 rounded-md opacity-70 animate-[pulse_1.5s_ease-in-out_infinite]"
          style={{ animationDelay: '0.3s' }}
        />
        <div
          className="absolute bottom-4 left-4 h-8 w-24 bg-blue-300 rounded-md opacity-70 animate-[pulse_1.5s_ease-in-out_infinite]"
          style={{ animationDelay: '0.4s' }}
        />
        <div
          className="absolute right-4 top-1/2 transform -translate-y-1/2 h-24 w-24 bg-gray-200 rounded-md opacity-70 animate-[pulse_1.5s_ease-in-out_infinite]"
          style={{ animationDelay: '0.2s' }}
        />
      </div>
      <div className="flex space-x-2 mt-2">
        {[1, 2, 3].map((itemKey) => (
          <div
            key={itemKey}
            className="flex-1 h-12 bg-gray-200 rounded-md opacity-70 animate-[pulse_1.5s_ease-in-out_infinite]"
            style={{ animationDelay: `${0.5 + itemKey * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// Step 3: Product Generation Preview (for 'store_skeleton_ready', 'image_processing')
function ProductGenerationPreviewV0({ statusText }: { statusText?: string }) {
  return (
    <div className="w-full h-full p-4 flex flex-col items-center justify-center">
      {statusText && (
        <div className="mb-3 h-6 text-sm font-medium text-muted-foreground text-center">
          {statusText}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        {[1, 2, 3, 4].map((itemKey) => (
          <div
            key={itemKey}
            className={`bg-background rounded-md p-2 shadow-sm border opacity-0 animate-[fadeIn_1s_forwards]`}
            style={{ animationDelay: `${itemKey * 0.2}s` }}
          >
            <div className="h-12 bg-gray-100 rounded-md mb-2 overflow-hidden relative animate-pulse" />
            <div className="space-y-1">
              <div
                className="h-3 bg-gray-200 rounded-md w-3/4 animate-pulse"
                style={{ animationDelay: `${itemKey * 0.2 + 0.1}s` }}
              />
              <div
                className="h-3 bg-gray-200 rounded-md w-1/2 animate-pulse"
                style={{ animationDelay: `${itemKey * 0.2 + 0.2}s` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 right-4 flex space-x-1">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <div
          className="h-2 w-2 rounded-full bg-primary animate-pulse"
          style={{ animationDelay: '0.3s' }}
        />
        <div
          className="h-2 w-2 rounded-full bg-primary animate-pulse"
          style={{ animationDelay: '0.6s' }}
        />
      </div>
    </div>
  );
}

// Step 4: Finalize Store Preview (for 'images_resolved')
function FinalizeStorePreviewV0() {
  return (
    <div className="w-full h-full p-4 relative flex flex-col items-center justify-center">
      <div className="text-sm font-medium text-muted-foreground mb-4">
        Finalizing your store...
      </div>
      <div className="w-full max-w-xs h-32 bg-gradient-to-br from-purple-100 via-pink-50 to-orange-100 rounded-lg relative overflow-hidden shadow-md">
        <div className="absolute inset-0 pointer-events-none">
          {[
            {
              key: 'fp1',
              top: '15%',
              left: '25%',
              delay: '0.2s',
              size: 'h-5 w-5',
            },
            {
              key: 'fp2',
              top: '30%',
              left: '75%',
              delay: '0.5s',
              size: 'h-4 w-4',
            },
            {
              key: 'fp3',
              top: '65%',
              left: '15%',
              delay: '0.8s',
              size: 'h-6 w-6',
            },
            {
              key: 'fp4',
              top: '70%',
              left: '60%',
              delay: '1.1s',
              size: 'h-3 w-3',
            },
          ].map((pos) => (
            <div
              key={pos.key} // Use a stable key from the object
              className={cn(
                'absolute rounded-full bg-green-400 flex items-center justify-center opacity-0 animate-[checkmarkAppear_0.5s_forwards]',
                pos.size,
              )}
              style={{
                top: pos.top,
                left: pos.left,
                animationDelay: pos.delay,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ))}
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 animate-[sweep_1.5s_ease-in-out_forwards]"
            style={{ animationDelay: '1.5s' }}
          />
        </div>
      </div>
      <div className="absolute bottom-4 right-4 flex space-x-1">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <div
          className="h-2 w-2 rounded-full bg-primary animate-pulse"
          style={{ animationDelay: '0.3s' }}
        />
      </div>
    </div>
  );
}
