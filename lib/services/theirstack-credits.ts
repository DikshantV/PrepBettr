import { getAdminFirestore } from '@/lib/firebase/admin';

export interface TheirStackCreditsData {
  month: string; // YYYY-MM format
  creditsUsed: number;
  creditsRemaining: number;
  lastUpdated: Date;
  warning?: string;
  isOverLimit: boolean;
}

export interface TheirStackCreditsSummary {
  currentMonth: TheirStackCreditsData;
  previousMonth: TheirStackCreditsData | null;
  yearToDate: number;
  averageMonthly: number;
}

export class TheirStackCreditsService {
  private static instance: TheirStackCreditsService;
  private firestore: any = null;

  // Credit limits
  private static readonly FREE_TIER_LIMIT = 200;
  private static readonly WARNING_THRESHOLD = 0.8; // 80%
  private static readonly EMERGENCY_LIMIT = 500;

  private constructor() {
    this.initializeFirestore();
  }

  public static getInstance(): TheirStackCreditsService {
    if (!TheirStackCreditsService.instance) {
      TheirStackCreditsService.instance = new TheirStackCreditsService();
    }
    return TheirStackCreditsService.instance;
  }

  private async initializeFirestore(): Promise<void> {
    try {
      this.firestore = await getAdminFirestore();
    } catch (error) {
      console.error('❌ Failed to initialize Firestore for TheirStack credits service:', error);
    }
  }

  /**
   * Get current month's credit usage
   */
  async getCurrentCredits(): Promise<TheirStackCreditsData> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return this.getCreditsForMonth(currentMonth);
  }

  /**
   * Get credits usage for a specific month
   */
  async getCreditsForMonth(month: string): Promise<TheirStackCreditsData> {
    if (!this.firestore) {
      await this.initializeFirestore();
    }

    try {
      const docRef = this.firestore
        .collection('usage')
        .doc('theirstackCredits')
        .collection('monthly')
        .doc(month);
      
      const doc = await docRef.get();
      const creditsUsed = doc.exists ? (doc.data()?.creditsUsed || 0) : 0;
      const creditsRemaining = Math.max(0, TheirStackCreditsService.FREE_TIER_LIMIT - creditsUsed);
      
      // Generate warning message if needed
      let warning: string | undefined;
      const isOverLimit = creditsUsed >= TheirStackCreditsService.EMERGENCY_LIMIT;
      
      if (isOverLimit) {
        warning = `⚠️ Emergency limit exceeded (${creditsUsed}/${TheirStackCreditsService.EMERGENCY_LIMIT})`;
      } else if (creditsUsed >= TheirStackCreditsService.FREE_TIER_LIMIT * TheirStackCreditsService.WARNING_THRESHOLD) {
        const percentage = Math.round((creditsUsed / TheirStackCreditsService.FREE_TIER_LIMIT) * 100);
        warning = `⚠️ ${percentage}% of free tier used (${creditsUsed}/${TheirStackCreditsService.FREE_TIER_LIMIT})`;
      }

      return {
        month,
        creditsUsed,
        creditsRemaining,
        lastUpdated: doc.exists ? (doc.data()?.lastUpdated?.toDate() || new Date()) : new Date(),
        warning,
        isOverLimit
      };

    } catch (error) {
      console.error('❌ Failed to get TheirStack credits for month:', month, error);
      
      // Return default data on error
      return {
        month,
        creditsUsed: 0,
        creditsRemaining: TheirStackCreditsService.FREE_TIER_LIMIT,
        lastUpdated: new Date(),
        isOverLimit: false
      };
    }
  }

  /**
   * Get comprehensive credits summary including historical data
   */
  async getCreditsSummary(): Promise<TheirStackCreditsSummary> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const previousMonth = this.getPreviousMonth(currentMonth);

    const [currentMonthData, previousMonthData, yearToDateCredits, averageMonthlyCredits] = await Promise.all([
      this.getCreditsForMonth(currentMonth),
      this.getCreditsForMonth(previousMonth),
      this.getYearToDateCredits(),
      this.getAverageMonthlyCredits()
    ]);

    return {
      currentMonth: currentMonthData,
      previousMonth: previousMonthData.creditsUsed > 0 ? previousMonthData : null,
      yearToDate: yearToDateCredits,
      averageMonthly: averageMonthlyCredits
    };
  }

  /**
   * Get total credits used in current year
   */
  async getYearToDateCredits(): Promise<number> {
    if (!this.firestore) {
      await this.initializeFirestore();
    }

    try {
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01`;
      const yearEnd = `${currentYear}-12`;

      const snapshot = await this.firestore
        .collection('usage')
        .doc('theirstackCredits')
        .collection('monthly')
        .where('month', '>=', yearStart)
        .where('month', '<=', yearEnd)
        .get();

      let totalCredits = 0;
      snapshot.docs.forEach((doc: any) => {
        totalCredits += doc.data()?.creditsUsed || 0;
      });

      return totalCredits;

    } catch (error) {
      console.error('❌ Failed to get year-to-date credits:', error);
      return 0;
    }
  }

  /**
   * Get average monthly credits usage (last 6 months)
   */
  async getAverageMonthlyCredits(): Promise<number> {
    if (!this.firestore) {
      await this.initializeFirestore();
    }

    try {
      // Get last 6 months
      const months: string[] = [];
      const now = new Date();
      
      for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toISOString().slice(0, 7));
      }

      const snapshot = await this.firestore
        .collection('usage')
        .doc('theirstackCredits')
        .collection('monthly')
        .where('month', 'in', months)
        .get();

      let totalCredits = 0;
      let monthsWithData = 0;
      
      snapshot.docs.forEach((doc: any) => {
        const credits = doc.data()?.creditsUsed || 0;
        if (credits > 0) {
          totalCredits += credits;
          monthsWithData++;
        }
      });

      return monthsWithData > 0 ? Math.round(totalCredits / monthsWithData) : 0;

    } catch (error) {
      console.error('❌ Failed to get average monthly credits:', error);
      return 0;
    }
  }

  /**
   * Check if credits are approaching limits and return alert level
   */
  getCreditAlertLevel(creditsUsed: number): 'none' | 'warning' | 'danger' | 'emergency' {
    if (creditsUsed >= TheirStackCreditsService.EMERGENCY_LIMIT) {
      return 'emergency';
    } else if (creditsUsed >= TheirStackCreditsService.FREE_TIER_LIMIT) {
      return 'danger';
    } else if (creditsUsed >= TheirStackCreditsService.FREE_TIER_LIMIT * TheirStackCreditsService.WARNING_THRESHOLD) {
      return 'warning';
    }
    return 'none';
  }

  /**
   * Get credits health status for dashboard
   */
  async getCreditsHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical' | 'emergency';
    message: string;
    creditsUsed: number;
    creditsRemaining: number;
    percentage: number;
  }> {
    const currentCredits = await this.getCurrentCredits();
    const percentage = Math.round((currentCredits.creditsUsed / TheirStackCreditsService.FREE_TIER_LIMIT) * 100);
    
    let status: 'healthy' | 'warning' | 'critical' | 'emergency';
    let message: string;

    if (currentCredits.isOverLimit) {
      status = 'emergency';
      message = `Emergency limit exceeded! ${currentCredits.creditsUsed} credits used this month.`;
    } else if (currentCredits.creditsUsed >= TheirStackCreditsService.FREE_TIER_LIMIT) {
      status = 'critical';
      message = `Free tier limit exceeded! ${currentCredits.creditsUsed}/${TheirStackCreditsService.FREE_TIER_LIMIT} credits used (${percentage}%).`;
    } else if (percentage >= 80) {
      status = 'warning';
      message = `Approaching free tier limit: ${currentCredits.creditsUsed}/${TheirStackCreditsService.FREE_TIER_LIMIT} credits used (${percentage}%).`;
    } else {
      status = 'healthy';
      message = `Credits usage is healthy: ${currentCredits.creditsUsed}/${TheirStackCreditsService.FREE_TIER_LIMIT} credits used (${percentage}%).`;
    }

    return {
      status,
      message,
      creditsUsed: currentCredits.creditsUsed,
      creditsRemaining: currentCredits.creditsRemaining,
      percentage
    };
  }

  /**
   * Get historical credits data for charts (last 12 months)
   */
  async getHistoricalCreditsData(): Promise<Array<{ month: string; creditsUsed: number; date: Date }>> {
    if (!this.firestore) {
      await this.initializeFirestore();
    }

    try {
      // Get last 12 months
      const months: string[] = [];
      const now = new Date();
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toISOString().slice(0, 7));
      }

      const snapshot = await this.firestore
        .collection('usage')
        .doc('theirstackCredits')
        .collection('monthly')
        .where('month', 'in', months)
        .get();

      // Create a map for quick lookup
      const dataMap = new Map();
      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        dataMap.set(data.month, data.creditsUsed || 0);
      });

      // Build the historical data array
      return months.map(month => ({
        month,
        creditsUsed: dataMap.get(month) || 0,
        date: new Date(`${month}-01`)
      }));

    } catch (error) {
      console.error('❌ Failed to get historical credits data:', error);
      return [];
    }
  }

  /**
   * Helper method to get previous month string
   */
  private getPreviousMonth(month: string): string {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 2, 1); // monthNum - 2 because Date months are 0-indexed
    return date.toISOString().slice(0, 7);
  }

  /**
   * Get credits configuration for display
   */
  static getCreditsConfiguration() {
    return {
      freeTierLimit: TheirStackCreditsService.FREE_TIER_LIMIT,
      warningThreshold: Math.round(TheirStackCreditsService.FREE_TIER_LIMIT * TheirStackCreditsService.WARNING_THRESHOLD),
      emergencyLimit: TheirStackCreditsService.EMERGENCY_LIMIT,
      warningPercentage: TheirStackCreditsService.WARNING_THRESHOLD * 100
    };
  }
}

// Export convenience functions
export const theirStackCreditsService = TheirStackCreditsService.getInstance();

export async function getCurrentTheirStackCredits(): Promise<TheirStackCreditsData> {
  return theirStackCreditsService.getCurrentCredits();
}

export async function getTheirStackCreditsSummary(): Promise<TheirStackCreditsSummary> {
  return theirStackCreditsService.getCreditsSummary();
}

export async function getTheirStackCreditsHealth() {
  return theirStackCreditsService.getCreditsHealthStatus();
}

export default TheirStackCreditsService;
