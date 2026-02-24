import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

type OpenAIProvider = ReturnType<typeof createOpenAI>;

export const openAI = (): OpenAIProvider => {
  return createOpenAI({});
};

type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;

export const google = (): GoogleProvider => {
  if (!process.env.GOOGLE_API_KEY) {
    console.warn(
      '[AI Providers] GOOGLE_API_KEY is not set. Google API calls will likely fail.',
    );
  }
  return createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
  });
};
