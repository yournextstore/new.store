export interface HeliconeRequestContext {
  vercelRequestId?: string;
  userId?: string;
  userEmail?: string;
  // We can also include sessionId here if it's useful for all Helicone calls
  // sessionId?: string;
}
