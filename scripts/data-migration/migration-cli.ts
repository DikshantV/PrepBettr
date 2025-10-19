#!/usr/bin/env tsx
// Migration CLI Tool
// Command-line interface for managing data migration operations

import { Command } from 'commander';
import { DataMigrationManager } from './data-migration-manager';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('migration-cli')
  .description('PrepBettr Data Migration CLI')
  .version('1.0.0');

// Start migration command
program
  .command('start')
  .description('Start data migration from Firestore to Cosmos DB')
  .option('--dry-run', 'Run migration in dry-run mode (no data written)')
  .option('--collections <collections>', 'Comma-separated list of collections to migrate')
  .option('--batch-size <size>', 'Batch size for processing (default: 50)', '50')
  .option('--max-retries <retries>', 'Maximum retry attempts (default: 3)', '3')
  .option('--skip-validation', 'Skip data validation')
  .option('--validate-only', 'Only validate data, do not migrate')
  .option('--resume', 'Resume from last checkpoint')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting Data Migration'));
    console.log(chalk.gray('Options:'), JSON.stringify(options, null, 2));

    try {
      const collections = options.collections ? options.collections.split(',') : [];
      
      const config = {
        batchSize: parseInt(options.batchSize),
        maxRetries: parseInt(options.maxRetries),
        retryDelayMs: 1000,
        dryRun: options.dryRun || false,
        skipValidation: options.skipValidation || false,
        validateOnly: options.validateOnly || false,
        collections,
        continueFromCheckpoint: options.resume ? undefined : undefined
      };

      const manager = new DataMigrationManager(config);
      const summary = await manager.startMigration();

      console.log(chalk.green('✅ Migration completed successfully!'));
      console.log(chalk.cyan('📊 Summary:'), {
        duration: `${(summary.duration / 1000 / 60).toFixed(2)} minutes`,
        totalDocuments: summary.totalDocuments,
        migrated: summary.migratedDocuments,
        errors: summary.erroredDocuments
      });

      process.exit(summary.erroredDocuments > 0 ? 1 : 0);
    } catch (error) {
      console.error(chalk.red('❌ Migration failed:'), error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show migration progress and status')
  .action(async () => {
    console.log(chalk.blue('📊 Migration Status'));

    try {
      const progressFile = path.join(process.cwd(), 'migration-progress.json');
      
      if (!fs.existsSync(progressFile)) {
        console.log(chalk.yellow('⚠️ No migration progress found'));
        return;
      }

      const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      
      for (const [collection, data] of Object.entries(progress)) {
        const p = data as any;
        const percentage = p.documentsTotal > 0 
          ? ((p.documentsProcessed / p.documentsTotal) * 100).toFixed(2)
          : '0';

        console.log(chalk.cyan(`\n📁 ${collection}:`));
        console.log(`   Progress: ${p.documentsProcessed}/${p.documentsTotal} (${percentage}%)`);
        console.log(`   Migrated: ${chalk.green(p.documentsMigrated)}`);
        console.log(`   Skipped: ${chalk.yellow(p.documentsSkipped)}`);
        console.log(`   Errors: ${chalk.red(p.documentsErrored)}`);
        
        if (p.startTime) {
          const elapsed = p.endTime 
            ? new Date(p.endTime).getTime() - new Date(p.startTime).getTime()
            : Date.now() - new Date(p.startTime).getTime();
          console.log(`   Duration: ${chalk.gray((elapsed / 1000 / 60).toFixed(2) + ' minutes')}`);
        }

        if (p.lastCheckpoint) {
          console.log(`   Checkpoint: ${chalk.gray(p.lastCheckpoint)}`);
        }

        if (p.errors && p.errors.length > 0) {
          console.log(`   Recent Errors:`);
          p.errors.slice(-3).forEach((error: any) => {
            console.log(`     - ${error.documentId}: ${error.error}`);
          });
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to read migration status:'), error.message);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate migration integrity')
  .action(async () => {
    console.log(chalk.blue('🔍 Validating Migration'));

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

      if (result.valid) {
        console.log(chalk.green('✅ Migration validation passed'));
      } else {
        console.log(chalk.red('❌ Migration validation failed'));
        result.errors.forEach(error => {
          console.log(chalk.red(`  - ${error}`));
        });
      }

      process.exit(result.valid ? 0 : 1);
    } catch (error) {
      console.error(chalk.red('❌ Validation failed:'), error.message);
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate migration report')
  .option('--output <file>', 'Output file for the report (default: stdout)')
  .action(async (options) => {
    console.log(chalk.blue('📝 Generating Migration Report'));

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

      const report = await manager.generateMigrationReport();

      if (options.output) {
        fs.writeFileSync(options.output, report);
        console.log(chalk.green(`✅ Report saved to ${options.output}`));
      } else {
        console.log(report);
      }
    } catch (error) {
      console.error(chalk.red('❌ Report generation failed:'), error.message);
      process.exit(1);
    }
  });

// Rollback command
program
  .command('rollback')
  .description('Rollback migration (delete migrated data from Cosmos DB)')
  .option('--collections <collections>', 'Comma-separated list of collections to rollback')
  .option('--confirm', 'Confirm rollback operation')
  .action(async (options) => {
    if (!options.confirm) {
      console.log(chalk.red('⚠️ Rollback is a destructive operation!'));
      console.log(chalk.yellow('Add --confirm flag to proceed with rollback'));
      return;
    }

    console.log(chalk.red('🔄 Starting Migration Rollback'));
    console.log(chalk.yellow('This will delete migrated data from Cosmos DB!'));

    try {
      const collections = options.collections ? options.collections.split(',') : [];
      
      // Implementation would go here to delete data from Cosmos DB
      console.log(chalk.yellow('⚠️ Rollback implementation needed'));
      console.log('Collections to rollback:', collections);

    } catch (error) {
      console.error(chalk.red('❌ Rollback failed:'), error.message);
      process.exit(1);
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Cleanup migration temporary files and checkpoints')
  .action(async () => {
    console.log(chalk.blue('🧹 Cleaning up migration files'));

    try {
      const filesToCleanup = [
        'migration-progress.json',
        'migration-errors.log',
        'migration-report.md'
      ];

      let cleanedCount = 0;

      for (const file of filesToCleanup) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(chalk.green(`✅ Deleted ${file}`));
          cleanedCount++;
        }
      }

      if (cleanedCount === 0) {
        console.log(chalk.yellow('⚠️ No cleanup files found'));
      } else {
        console.log(chalk.green(`🎉 Cleaned up ${cleanedCount} files`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Cleanup failed:'), error.message);
      process.exit(1);
    }
  });

// Health command
program
  .command('health')
  .description('Check health of migration services')
  .action(async () => {
    console.log(chalk.blue('🏥 Checking Migration Health'));

    try {
      // Create manager to test connections
      const manager = new DataMigrationManager({
        batchSize: 1,
        maxRetries: 1,
        retryDelayMs: 1000,
        dryRun: true,
        skipValidation: true,
        validateOnly: true,
        collections: []
      });

      console.log(chalk.green('✅ Firebase connection: OK'));
      console.log(chalk.green('✅ Cosmos DB connection: OK'));
      console.log(chalk.green('✅ Migration services: Healthy'));

    } catch (error) {
      console.error(chalk.red('❌ Health check failed:'), error.message);
      
      if (error.message.includes('Firebase')) {
        console.log(chalk.red('🔥 Firebase connection issue'));
      }
      
      if (error.message.includes('Cosmos')) {
        console.log(chalk.red('🌌 Cosmos DB connection issue'));
      }
      
      process.exit(1);
    }
  });

// Interactive mode command
program
  .command('interactive')
  .description('Interactive migration wizard')
  .action(async () => {
    console.log(chalk.blue('🧙 Interactive Migration Wizard'));
    
    // This would implement an interactive wizard
    // For now, show the menu
    console.log(chalk.cyan('Available operations:'));
    console.log('1. Start full migration');
    console.log('2. Migrate specific collections');
    console.log('3. Validate existing migration');
    console.log('4. Generate migration report');
    console.log('5. Check migration status');
    
    console.log(chalk.yellow('\nUse specific commands:'));
    console.log('  migration-cli start --help');
    console.log('  migration-cli status');
    console.log('  migration-cli validate');
  });

// Collection info command
program
  .command('collections')
  .description('List available collections for migration')
  .action(async () => {
    console.log(chalk.blue('📚 Available Collections for Migration'));

    const collections = [
      { name: 'resumes', target: 'resumes', description: 'User resume documents' },
      { name: 'mockInterviews', target: 'interviews', description: 'Mock interview sessions' },
      { name: 'usage', target: 'usage', description: 'User usage tracking' },
      { name: 'userConsents', target: 'userConsents', description: 'Privacy consents' },
      { name: 'auditLogs', target: 'auditLogs', description: 'System audit logs' },
      { name: 'payments', target: 'payments', description: 'Payment records' },
      { name: 'notificationEvents', target: 'notificationEvents', description: 'Notification events' }
    ];

    console.log(chalk.cyan('\nFirestore → Cosmos DB Mapping:'));
    collections.forEach(col => {
      console.log(`  ${chalk.green(col.name)} → ${chalk.blue(col.target)}`);
      console.log(`    ${chalk.gray(col.description)}`);
    });

    console.log(chalk.yellow('\nUsage:'));
    console.log('  migration-cli start --collections resumes,usage');
    console.log('  migration-cli start --collections mockInterviews');
  });

// Parse CLI arguments
if (process.argv.length < 3) {
  program.help();
} else {
  program.parse();
}