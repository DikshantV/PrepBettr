/**
 * Migration Management API Routes
 * Control and monitor the data layer migration process
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  initializeDataLayerFromConfig, 
  MigrationPhaseController,
  DATA_LAYER_CONFIG_KEYS,
  measureOperation 
} from '@/lib/data-layer/utils/integration';
import { MigrationPhase } from '@/lib/data-layer/services/DataLayerServiceFactory';
import { unifiedConfigService } from '@/lib/services/unified-config-service';

const migrationController = new MigrationPhaseController();

/**
 * GET /api/data-layer-examples/migration
 * Get current migration status and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        return await getMigrationStatus();
      
      case 'health':
        return await getHealthStatus();
      
      case 'metrics':
        return await getMigrationMetrics();
      
      case 'validate':
        return await validateMigrationReadiness();
      
      default:
        return await getMigrationOverview();
    }

  } catch (error) {
    console.error('Migration API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-layer-examples/migration
 * Start migration or update migration phase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, phase, migrationConfig } = body;

    switch (action) {
      case 'start':
        return await startMigration(migrationConfig);
      
      case 'updatePhase':
        return await updateMigrationPhase(phase);
      
      case 'validate':
        return await performPreMigrationChecks();
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Migration API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get comprehensive migration overview
 */
async function getMigrationOverview() {
  const factory = await initializeDataLayerFromConfig();
  const currentPhase = await migrationController.getCurrentPhase();
  const metrics = factory.getMetrics();

  return NextResponse.json({
    success: true,
    data: {
      currentPhase,
      configuration: {
        enableDualWrite: await unifiedConfigService.get(DATA_LAYER_CONFIG_KEYS.ENABLE_DUAL_WRITE, false),
        enableConsistencyValidation: await unifiedConfigService.get(DATA_LAYER_CONFIG_KEYS.ENABLE_CONSISTENCY_VALIDATION, true),
        enableAsyncWrites: await unifiedConfigService.get(DATA_LAYER_CONFIG_KEYS.ASYNC_WRITES, true),
        batchSize: await unifiedConfigService.get(DATA_LAYER_CONFIG_KEYS.BATCH_SIZE, 50),
        retryAttempts: await unifiedConfigService.get(DATA_LAYER_CONFIG_KEYS.RETRY_ATTEMPTS, 3)
      },
      metrics,
      availablePhases: [
        MigrationPhase.FIRESTORE_ONLY,
        MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY,
        MigrationPhase.DUAL_WRITE_WITH_VALIDATION,
        MigrationPhase.DUAL_WRITE_COSMOS_PRIMARY,
        MigrationPhase.COSMOS_DB_ONLY
      ]
    }
  });
}

/**
 * Get current migration status
 */
async function getMigrationStatus() {
  const factory = await initializeDataLayerFromConfig();
  const migrationManager = factory.getMigrationManager();
  const currentPhase = await migrationController.getCurrentPhase();

  let activeMigrations: any[] = [];
  
  if (migrationManager) {
    // Note: This would need to be implemented to get all active migrations
    // For now, return placeholder
    activeMigrations = [];
  }

  return NextResponse.json({
    success: true,
    data: {
      currentPhase,
      hasMigrationManager: !!migrationManager,
      activeMigrations,
      systemReady: true // This could be determined by health checks
    }
  });
}

/**
 * Get system health status
 */
async function getHealthStatus() {
  const result = await measureOperation(
    'health_check',
    async () => {
      const factory = await initializeDataLayerFromConfig();
      return await factory.performHealthCheck();
    }
  );

  if (!result.success) {
    return NextResponse.json({
      success: false,
      error: result.error
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: result.data
  });
}

/**
 * Get migration metrics
 */
async function getMigrationMetrics() {
  const factory = await initializeDataLayerFromConfig();
  const metrics = factory.getMetrics();

  // Get time-based metrics (last 24 hours)
  const last24Hours = {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date()
  };

  return NextResponse.json({
    success: true,
    data: {
      overall: metrics,
      last24Hours: {
        // This would need to be implemented in the metrics collector
        // For now, return the overall metrics
        ...metrics
      }
    }
  });
}

/**
 * Validate migration readiness
 */
async function validateMigrationReadiness() {
  const result = await measureOperation(
    'validate_migration_readiness',
    async () => {
      const factory = await initializeDataLayerFromConfig();
      return await factory.validateMigrationReadiness();
    }
  );

  if (!result.success) {
    return NextResponse.json({
      success: false,
      error: result.error
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: result.data
  });
}

/**
 * Start data migration
 */
async function startMigration(migrationConfig: any) {
  try {
    const factory = await initializeDataLayerFromConfig();
    const migrationManager = factory.getMigrationManager();

    if (!migrationManager) {
      return NextResponse.json({
        success: false,
        error: 'Migration manager not available in current phase'
      }, { status: 400 });
    }

    const defaultConfig = {
      direction: 'firestore-to-cosmos' as const,
      collections: ['resumes', 'usage'],
      batchSize: await unifiedConfigService.get(DATA_LAYER_CONFIG_KEYS.BATCH_SIZE, 50),
      validateData: true,
      continueOnError: true,
      createBackup: true,
      retryAttempts: await unifiedConfigService.get(DATA_LAYER_CONFIG_KEYS.RETRY_ATTEMPTS, 3)
    };

    const finalConfig = { ...defaultConfig, ...migrationConfig };

    const migrationId = await measureOperation(
      'start_migration',
      () => migrationManager.startMigration(finalConfig),
      { config: finalConfig }
    );

    return NextResponse.json({
      success: true,
      data: {
        migrationId,
        config: finalConfig,
        message: 'Migration started successfully'
      }
    });

  } catch (error) {
    console.error('Failed to start migration:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to start migration'
    }, { status: 500 });
  }
}

/**
 * Update migration phase
 */
async function updateMigrationPhase(newPhase: MigrationPhase) {
  try {
    if (!Object.values(MigrationPhase).includes(newPhase)) {
      return NextResponse.json({
        success: false,
        error: `Invalid migration phase: ${newPhase}`
      }, { status: 400 });
    }

    const currentPhase = await migrationController.getCurrentPhase();
    
    // Validate phase transition
    const validation = await migrationController.validatePhaseTransition(currentPhase, newPhase);
    
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid phase transition',
        issues: validation.issues,
        recommendations: validation.recommendations
      }, { status: 400 });
    }

    // Update the phase
    await measureOperation(
      'update_migration_phase',
      () => migrationController.updateMigrationPhase(newPhase),
      { fromPhase: currentPhase, toPhase: newPhase }
    );

    return NextResponse.json({
      success: true,
      data: {
        previousPhase: currentPhase,
        newPhase,
        message: `Migration phase updated to ${newPhase}`,
        recommendations: validation.recommendations
      }
    });

  } catch (error) {
    console.error('Failed to update migration phase:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update migration phase'
    }, { status: 500 });
  }
}

/**
 * Perform pre-migration checks
 */
async function performPreMigrationChecks() {
  try {
    const result = await measureOperation(
      'pre_migration_checks',
      () => migrationController.performPreMigrationChecks()
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Failed to perform pre-migration checks:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to perform pre-migration checks'
    }, { status: 500 });
  }
}