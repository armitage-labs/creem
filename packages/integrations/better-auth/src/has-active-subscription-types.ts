/**
 * Response from hasAccessGranted endpoint
 */
export interface HasAccessGrantedResponse {
  /**
   * Whether the user has access granted
   * - `true` - User has active access
   * - `false` - User has no active access
   * - `undefined` - Could not determine (not logged in, persistence disabled, or error)
   */
  hasAccessGranted: boolean | undefined;

  /**
   * Human-readable message explaining the status
   */
  message?: string;

  /**
   * Active subscription details (if hasAccessGranted is true)
   */
  subscription?: {
    id: string;
    status: string;
    productId: string;
    periodEnd?: Date | string;
  };

  /**
   * All subscriptions (if hasAccessGranted is false)
   * Useful for debugging or showing expired subscriptions
   */
  subscriptions?: Array<{
    id: string;
    status: string;
    productId: string;
    periodEnd?: Date | string;
  }>;

  /**
   * Error message (if an error occurred)
   */
  error?: string;
}
