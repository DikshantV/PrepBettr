/**
 * Redirect guard utility to prevent infinite redirect loops
 * during authentication flows
 */

class RedirectGuard {
  private static readonly STORAGE_KEY = 'redirect_guard';
  private static readonly MAX_REDIRECTS = 3;
  private static readonly RESET_INTERVAL = 30000; // 30 seconds

  private static getRedirectCount(): number {
    if (typeof window === 'undefined') return 0;
    
    try {
      const data = sessionStorage.getItem(this.STORAGE_KEY);
      if (!data) return 0;
      
      const { count, timestamp } = JSON.parse(data);
      const now = Date.now();
      
      // Reset counter if enough time has passed
      if (now - timestamp > this.RESET_INTERVAL) {
        this.resetCount();
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      console.error('RedirectGuard: Error reading redirect count:', error);
      return 0;
    }
  }

  private static setRedirectCount(count: number): void {
    if (typeof window === 'undefined') return;
    
    try {
      const data = {
        count,
        timestamp: Date.now()
      };
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('RedirectGuard: Error setting redirect count:', error);
    }
  }

  private static resetCount(): void {
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('RedirectGuard: Error resetting redirect count:', error);
    }
  }

  /**
   * Check if a redirect is allowed based on current redirect count
   * @param targetPath - The path we want to redirect to
   * @returns true if redirect is allowed, false if it should be blocked
   */
  public static canRedirect(targetPath: string): boolean {
    const currentCount = this.getRedirectCount();
    
    if (currentCount >= this.MAX_REDIRECTS) {
      console.warn(`RedirectGuard: Blocking redirect to ${targetPath} - max redirects (${this.MAX_REDIRECTS}) reached`);
      return false;
    }
    
    return true;
  }

  /**
   * Increment the redirect counter when a redirect is about to happen
   * @param fromPath - Current path
   * @param toPath - Target path
   */
  public static recordRedirect(fromPath: string, toPath: string): void {
    const currentCount = this.getRedirectCount();
    const newCount = currentCount + 1;
    
    console.log(`RedirectGuard: Recording redirect ${newCount}/${this.MAX_REDIRECTS} from ${fromPath} to ${toPath}`);
    this.setRedirectCount(newCount);
  }

  /**
   * Reset the redirect counter (useful after successful authentication)
   */
  public static reset(): void {
    console.log('RedirectGuard: Resetting redirect counter');
    this.resetCount();
  }

  /**
   * Check if we're potentially in a redirect loop between two pages
   * @param fromPath - Current path  
   * @param toPath - Target path
   * @returns true if this looks like a loop
   */
  public static isLoop(fromPath: string, toPath: string): boolean {
    // Simple loop detection: if we're redirecting between /sign-in and /dashboard
    const isAuthLoop = (
      (fromPath.includes('/sign-in') && toPath.includes('/dashboard')) ||
      (fromPath.includes('/dashboard') && toPath.includes('/sign-in'))
    );
    
    return isAuthLoop && this.getRedirectCount() > 0;
  }
}

export default RedirectGuard;
