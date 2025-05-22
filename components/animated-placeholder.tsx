"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnimatedPlaceholderProps {
  className?: string
  onComplete?: () => void
  autoPlay?: boolean
  duration?: number
}

export function AnimatedPlaceholder({
  className,
  onComplete,
  autoPlay = true,
  duration = 2000,
}: AnimatedPlaceholderProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [heroSectionData, setHeroSectionData] = useState<{
    storeName?: string
    storeDescription?: string
    ctaText?: string
    heroImageUrl?: string
  } | null>(null)

  const steps = ["Generating store", "Generating hero section", "Generating products", "Finalizing store generation"]

  // Simulate fetching hero section data when step 1 is complete
  const fetchHeroSectionData = () => {
    // This simulates the API response with hero section data
    return {
      storeName: "Glow in Luxury",
      storeDescription: "Hand-poured candles for warmth, comfort, and elegance.",
      ctaText: "Shop Now",
      heroImageUrl: "/luxury-candles.jpg",
    }
  }

  useEffect(() => {
    if (!autoPlay) return

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        // When moving from step 1 to step 2 (hero section complete)
        if (prev === 1) {
          // Simulate fetching hero section data
          const heroData = fetchHeroSectionData()
          setHeroSectionData(heroData)
        }

        if (prev === steps.length - 1) {
          clearInterval(interval)
          setIsComplete(true)
          onComplete?.()
          return prev
        }
        return prev + 1
      })
    }, duration)

    return () => clearInterval(interval)
  }, [autoPlay, duration, onComplete, steps.length])

  return (
    <div className={cn("w-full max-w-md mx-auto p-6 rounded-lg border shadow-sm", className)}>
      <div className="space-y-6">
        <div className="flex items-center justify-center">
          {!isComplete ? (
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          ) : (
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
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          )}
        </div>

        {/* Preview Section */}
        <div className="w-full h-48 bg-gray-50 rounded-lg border overflow-hidden">
          {heroSectionData && currentStep > 1 ? (
            <HeroSectionPreview heroData={heroSectionData} />
          ) : (
            <>
              {currentStep === 0 && <StoreGenerationPreview />}
              {currentStep === 1 && <HeroSectionPreview />}
              {currentStep === 2 && <ProductGenerationPreview />}
              {currentStep === 3 && <FinalizeStorePreview />}
            </>
          )}
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
                    index < currentStep
                      ? "bg-green-500 text-white"
                      : index === currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {index < currentStep ? (
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
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <div
                  className={cn(
                    "text-sm font-medium transition-colors duration-200",
                    index === currentStep
                      ? "text-foreground"
                      : index < currentStep
                        ? "text-muted-foreground line-through"
                        : "text-muted-foreground",
                  )}
                >
                  {step}
                </div>
              </div>

              {index < steps.length - 1 && <div className="ml-3 pl-3 border-l h-4 border-muted" />}
            </div>
          ))}
        </div>

        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-500 ease-in-out"
            style={{
              width: isComplete ? "100%" : `${(currentStep / (steps.length - 1)) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// Step 1: Store Generation Preview
function StoreGenerationPreview() {
  return (
    <div className="w-full h-full p-4 flex flex-col animate-pulse">
      {/* Header */}
      <div className="h-6 bg-gray-200 rounded-md w-3/4 mb-4 animate-[pulse_2s_ease-in-out_infinite]"></div>

      {/* Navigation */}
      <div className="flex space-x-2 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-4 bg-gray-200 rounded-md w-16 animate-[pulse_2s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.1}s` }}
          ></div>
        ))}
      </div>

      {/* Grid of products appearing one by one */}
      <div className="grid grid-cols-2 gap-2 flex-grow">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col space-y-2 opacity-0 animate-[fadeIn_2s_forwards]"
            style={{ animationDelay: `${i * 0.5}s` }}
          >
            <div className="h-16 bg-gray-200 rounded-md"></div>
            <div className="h-3 bg-gray-200 rounded-md w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded-md w-1/2"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Step 2: Hero Section Preview
function HeroSectionPreview({
  heroData,
}: { heroData?: { storeName?: string; storeDescription?: string; ctaText?: string; heroImageUrl?: string } }) {
  // If heroData is provided, render the actual hero section
  if (heroData) {
    return (
      <div className="w-full h-full relative overflow-hidden animate-[fadeIn_0.5s_forwards]">
        <div className="w-full h-full bg-gradient-to-r from-blue-100 to-purple-100 p-4 flex items-center justify-between">
          <div className="space-y-2 max-w-[60%]">
            <h2 className="font-bold text-lg text-gray-800">{heroData.storeName}</h2>
            <p className="text-sm text-gray-700">{heroData.storeDescription}</p>
            <button className="mt-2 px-4 py-1 bg-blue-600 text-white rounded-md text-sm font-medium">
              {heroData.ctaText || "Shop Now"}
            </button>
          </div>
          {heroData.heroImageUrl && (
            <div className="h-24 w-24 rounded-md overflow-hidden">
              <img
                src={heroData.heroImageUrl || "/placeholder.svg"}
                alt={heroData.storeName || "Store logo"}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* "Preview" badge */}
        <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">Preview</div>
      </div>
    )
  }

  // Otherwise, render the animation placeholder
  return (
    <div className="w-full h-full p-4 flex flex-col">
      {/* Hero background appearing */}
      <div className="w-full h-32 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg mb-4 relative overflow-hidden">
        {/* Animated elements appearing in the hero */}
        <div
          className="absolute top-4 left-4 h-6 w-32 bg-gray-700 rounded-md opacity-0 animate-[fadeIn_1s_forwards]"
          style={{ animationDelay: "0.5s" }}
        ></div>
        <div
          className="absolute top-12 left-4 h-4 w-48 bg-gray-600 rounded-md opacity-0 animate-[fadeIn_1s_forwards]"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute top-18 left-4 h-4 w-24 bg-gray-500 rounded-md opacity-0 animate-[fadeIn_1s_forwards]"
          style={{ animationDelay: "1.5s" }}
        ></div>

        {/* CTA button */}
        <div
          className="absolute bottom-4 left-4 h-8 w-24 bg-blue-500 rounded-md opacity-0 animate-[fadeIn_1s_forwards]"
          style={{ animationDelay: "2s" }}
        ></div>

        {/* Hero image */}
        <div
          className="absolute right-4 top-1/2 transform -translate-y-1/2 h-24 w-24 bg-gray-300 rounded-md opacity-0 animate-[fadeIn_1s_forwards]"
          style={{ animationDelay: "1.2s" }}
        ></div>
      </div>

      {/* Featured products section */}
      <div className="flex space-x-2 mt-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 h-12 bg-gray-200 rounded-md opacity-0 animate-[fadeIn_1s_forwards]"
            style={{ animationDelay: `${2 + i * 0.3}s` }}
          ></div>
        ))}
      </div>
    </div>
  )
}

// Step 3: Product Generation Preview
function ProductGenerationPreview() {
  return (
    <div className="w-full h-full p-4">
      <div className="mb-3 h-6 bg-gray-200 rounded-md w-1/2 mx-auto"></div>

      {/* Products being generated */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className={`bg-white rounded-md p-2 shadow-sm border opacity-0 ${i <= 4 ? "animate-[fadeIn_1s_forwards]" : ""}`}
            style={{ animationDelay: `${i * 0.4}s` }}
          >
            {/* Product image */}
            <div className="h-12 bg-gray-100 rounded-md mb-2 overflow-hidden relative">
              {i <= 3 && (
                <div
                  className="absolute inset-0 bg-gradient-to-r from-gray-200 to-gray-100 opacity-0 animate-[fadeIn_0.5s_forwards]"
                  style={{ animationDelay: `${i * 0.4 + 0.2}s` }}
                ></div>
              )}
            </div>

            {/* Product details */}
            <div className="space-y-1">
              <div
                className="h-3 bg-gray-200 rounded-md w-3/4 opacity-0 animate-[fadeIn_0.5s_forwards]"
                style={{ animationDelay: `${i * 0.4 + 0.3}s` }}
              ></div>
              <div
                className="h-3 bg-gray-200 rounded-md w-1/2 opacity-0 animate-[fadeIn_0.5s_forwards]"
                style={{ animationDelay: `${i * 0.4 + 0.4}s` }}
              ></div>
              <div
                className="h-4 bg-blue-100 rounded-md w-1/3 mt-1 opacity-0 animate-[fadeIn_0.5s_forwards]"
                style={{ animationDelay: `${i * 0.4 + 0.5}s` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Product generation indicators */}
      <div className="absolute bottom-4 right-4 flex space-x-1">
        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "0.3s" }}></div>
        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "0.6s" }}></div>
      </div>
    </div>
  )
}

// Step 3: Finalize Store Preview
function FinalizeStorePreview() {
  return (
    <div className="w-full h-full p-4 relative">
      {/* Complete store layout */}
      <div className="absolute inset-0 p-4">
        {/* Header */}
        <div className="h-6 bg-gray-800 rounded-md w-full mb-3"></div>

        {/* Hero */}
        <div className="h-24 bg-gradient-to-r from-blue-200 to-purple-200 rounded-md w-full mb-3 flex items-center justify-between p-3">
          <div className="space-y-1">
            <div className="h-4 bg-gray-700 rounded-md w-32"></div>
            <div className="h-3 bg-gray-600 rounded-md w-48"></div>
            <div className="h-6 bg-blue-500 rounded-md w-20 mt-2"></div>
          </div>
          <div className="h-16 w-16 bg-gray-300 rounded-md"></div>
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col space-y-1">
              <div className="h-10 bg-gray-200 rounded-md"></div>
              <div className="h-2 bg-gray-400 rounded-md w-3/4"></div>
              <div className="h-2 bg-gray-600 rounded-md w-1/2"></div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="h-8 bg-gray-800 rounded-md w-full"></div>
      </div>

      {/* Finishing touches animations */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Checkmarks appearing */}
        {[
          { top: "20%", left: "20%", delay: "0.5s" },
          { top: "40%", left: "70%", delay: "0.8s" },
          { top: "60%", left: "30%", delay: "1.1s" },
          { top: "80%", left: "60%", delay: "1.4s" },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute h-6 w-6 rounded-full bg-green-500 flex items-center justify-center opacity-0 animate-[checkmarkAppear_0.5s_forwards]"
            style={{
              top: pos.top,
              left: pos.left,
              animationDelay: pos.delay,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        ))}

        {/* Final polish animation */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 animate-[sweep_2s_ease-in-out_forwards]"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>
    </div>
  )
}
