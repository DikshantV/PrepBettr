// Migration Dashboard API
// Provides real-time migration progress and metrics for monitoring

import { NextRequest, NextResponse } from 'next/server';
import { DataMigrationManager } from '@/scripts/data-migration/data-migration-manager';
import { createDataStoreFactory } from '@/lib/data-layer/data-store-factory';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationDashboardData {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  progress: {
    [collection: string]: {
      collectionName: string;
      documentsTotal: number;
      documentsProcessed: number;
      documentsMigrated: number;
      documentsSkipped: number;
      documentsErrored: number;
      percentage: number;
      startTime?: string;
      endTime?: string;
      duration?: number;
      speed?: number;
      errors: Array<{
        documentId: string;
        error: string;
        timestamp: string;
      }>;
    };
  };
  summary: {
    totalCollections: number;
    completedCollections: number;
    totalDocuments: number;
    migratedDocuments: number;
    erroredDocuments: number;
    overallPercentage: number;
    estimatedTimeRemaining?: number;
    avgSpeed: number;
  };
  health: {
    firestoreHealthy: boolean;
    cosmosHealthy: boolean;
    dualWriteEnabled: boolean;
    lastUpdated: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const dashboardData = await generateDashboardData();
    
    return NextResponse.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('❌ Migration dashboard error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      data: null
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action, collections, options } = body;

    switch (action) {
      case 'start_migration':
        return await handleStartMigration(collections, options);
      
      case 'pause_migration':
        return await handlePauseMigration();
      
      case 'resume_migration':
        return await handleResumeMigration(collections, options);
      
      case 'validate_migration':
        return await handleValidateMigration();
      
      case 'reset_progress':
        return await handleResetProgress();
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Migration dashboard action error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function generateDashboardData(): Promise<MigrationDashboardData> {
  const progressFilePath = path.join(process.cwd(), 'migration-progress.json');
  const dataStoreFactory = createDataStoreFactory();
  
  // Load progress data
  let progressData: any = {};
  let status: MigrationDashboardData['status'] = 'not_started';
  
  if (fs.existsSync(progressFilePath)) {
    try {
      progressData = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
      
      // Determine status based on progress
      const collections = Object.values(progressData);
      const hasStarted = collections.some((col: any) => col.documentsProcessed > 0);
      const allCompleted = collections.every((col: any) => col.endTime);
      const hasErrors = collections.some((col: any) => col.documentsErrored > 0);
      
      if (!hasStarted) {
        status = 'not_started';
      } else if (allCompleted) {
        status = hasErrors ? 'failed' : 'completed';
      } else {
        status = 'in_progress';
      }
    } catch (error) {
      console.warn('⚠️ Failed to load progress data:', error.message);
    }
  }

  // Transform progress data for dashboard
  const progress: MigrationDashboardData['progress'] = {};
  let totalDocuments = 0;
  let migratedDocuments = 0;
  let erroredDocuments = 0;
  let totalSpeed = 0;
  let speedCount = 0;

  for (const [collection, data] of Object.entries(progressData)) {
    const col = data as any;
    const percentage = col.documentsTotal > 0 
      ? (col.documentsProcessed / col.documentsTotal) * 100
      : 0;

    let duration = 0;
    let speed = 0;

    if (col.startTime) {
      const endTime = col.endTime ? new Date(col.endTime) : new Date();
      const startTime = new Date(col.startTime);
      duration = endTime.getTime() - startTime.getTime();
      
      if (duration > 0) {
        speed = col.documentsProcessed / (duration / 1000);
        totalSpeed += speed;
        speedCount++;
      }
    }

    progress[collection] = {
      collectionName: col.collectionName || collection,
      documentsTotal: col.documentsTotal || 0,
      documentsProcessed: col.documentsProcessed || 0,
      documentsMigrated: col.documentsMigrated || 0,
      documentsSkipped: col.documentsSkipped || 0,
      documentsErrored: col.documentsErrored || 0,
      percentage,
      startTime: col.startTime,
      endTime: col.endTime,
      duration,
      speed,
      errors: (col.errors || []).slice(-5).map((error: any) => ({
        documentId: error.documentId,
        error: error.error,
        timestamp: error.timestamp
      }))
    };

    totalDocuments += col.documentsTotal || 0;
    migratedDocuments += col.documentsMigrated || 0;
    erroredDocuments += col.documentsErrored || 0;
  }

  const completedCollections = Object.values(progress).filter(col => col.endTime).length;
  const overallPercentage = totalDocuments > 0 
    ? (Object.values(progress).reduce((sum, col) => sum + col.documentsProcessed, 0) / totalDocuments) * 100
    : 0;
  
  const avgSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;
  
  // Estimate time remaining
  let estimatedTimeRemaining: number | undefined;
  if (avgSpeed > 0 && status === 'in_progress') {
    const remainingDocuments = totalDocuments - Object.values(progress).reduce((sum, col) => sum + col.documentsProcessed, 0);
    estimatedTimeRemaining = remainingDocuments / avgSpeed * 1000; // Convert to milliseconds
  }

  // Check health status
  let firestoreHealthy = true;
  let cosmosHealthy = true;

  try {
    const firestoreStore = dataStoreFactory.createFirestore();
    // Simple health check - we could implement a ping method
    firestoreHealthy = true;
  } catch (error) {
    firestoreHealthy = false;
  }

  try {
    const cosmosStore = dataStoreFactory.createCosmos();
    cosmosHealthy = true;
  } catch (error) {
    cosmosHealthy = false;
  }

  // Check if dual-write is enabled (this would come from config)
  const dualWriteEnabled = process.env.MIGRATION_DUAL_WRITE_ENABLED === 'true';

  return {
    status,
    progress,
    summary: {
      totalCollections: Object.keys(progress).length,
      completedCollections,
      totalDocuments,
      migratedDocuments,
      erroredDocuments,
      overallPercentage,
      estimatedTimeRemaining,
      avgSpeed
    },
    health: {
      firestoreHealthy,
      cosmosHealthy,
      dualWriteEnabled,
      lastUpdated: new Date().toISOString()
    }
  };
}

async function handleStartMigration(collections?: string[], options?: any): Promise<NextResponse> {
  try {
    const config = {
      batchSize: options?.batchSize || 50,
      maxRetries: options?.maxRetries || 3,
      retryDelayMs: 1000,
      dryRun: options?.dryRun || false,
      skipValidation: options?.skipValidation || false,
      validateOnly: options?.validateOnly || false,
      collections: collections || [],
    };

    // Start migration asynchronously
    const manager = new DataMigrationManager(config);
    
    // Don't await - let it run in background
    manager.startMigration()
      .then(summary => {
        console.log('✅ Background migration completed:', summary);
      })
      .catch(error => {
        console.error('❌ Background migration failed:', error);
      });

    return NextResponse.json({
      success: true,
      message: 'Migration started successfully',
      config
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handlePauseMigration(): Promise<NextResponse> {
  // This would require implementing pause functionality in DataMigrationManager
  return NextResponse.json({
    success: false,
    error: 'Pause functionality not yet implemented'
  }, { status: 501 });
}

async function handleResumeMigration(collections?: string[], options?: any): Promise<NextResponse> {
  try {
    const config = {
      batchSize: options?.batchSize || 50,
      maxRetries: options?.maxRetries || 3,
      retryDelayMs: 1000,
      dryRun: options?.dryRun || false,
      skipValidation: options?.skipValidation || false,
      validateOnly: options?.validateOnly || false,
      collections: collections || [],
      continueFromCheckpoint: true // Resume from checkpoint
    };

    const manager = new DataMigrationManager(config);
    
    // Start migration asynchronously
    manager.startMigration()
      .then(summary => {
        console.log('✅ Resumed migration completed:', summary);
      })
      .catch(error => {
        console.error('❌ Resumed migration failed:', error);
      });

    return NextResponse.json({
      success: true,
      message: 'Migration resumed successfully',
      config
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleValidateMigration(): Promise<NextResponse> {
  try {
    const manager = new DataMigrationManager({
      batchSize: 50,
      maxRetries: 3,
      retryDelayMs: 1000,
      dryRun: false,
      skipValidation: false,
      validateOnly: false,
      collections: []
    });

    const result = await manager.validateMigration();

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleResetProgress(): Promise<NextResponse> {
  try {
    const progressFilePath = path.join(process.cwd(), 'migration-progress.json');
    
    if (fs.existsSync(progressFilePath)) {
      fs.unlinkSync(progressFilePath);
    }

    // Also clean up related files
    const filesToCleanup = [
      'migration-errors.log',
      'migration-report.md'
    ];

    for (const file of filesToCleanup) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration progress reset successfully'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}