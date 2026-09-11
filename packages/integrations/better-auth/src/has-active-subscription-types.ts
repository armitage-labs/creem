/**
 * Response from hasAccessGranted endpoint
 */
export interface HasAccessGrantedResponse {
  /**
   * Whether the user has access granted
   * - `true` - User has active access
   * - `false` - User has no active access
   * Failures are returned through the client's `error` result, not as access decisions.
   */
  hasAccessGranted: boolean;

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
}
