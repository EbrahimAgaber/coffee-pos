/**
 * Master Test Runner for Coffee POS & Kitchen Display System (KDS)
 * 
 * Registers and executes all 4 test tiers:
 * - Tier 1: Feature Coverage (40 tests)
 * - Tier 2: Boundary & Corner Cases (31 tests)
 * - Tier 3: Pairwise Combinatorial Interactions (4 tests)
 * - Tier 4: Real-World Workload Scenarios (5 tests)
 * 
 * Run via:
 * npx tsx coffee-pos/tests/run_all_tests.ts
 */

import { runAllRegisteredSuites } from './e2e_harness';
import { registerTier1Tests } from './tier1_features.test';
import { registerTier2Tests } from './tier2_boundaries.test';
import { registerTier3Tests } from './tier3_pairwise.test';
import { registerTier4Tests } from './tier4_workloads.test';

async function main(): Promise<void> {
  // Register all tiers
  registerTier1Tests();
  registerTier2Tests();
  registerTier3Tests();
  registerTier4Tests();

  // Run all registered suites
  const summary = await runAllRegisteredSuites();

  if (!summary.success) {
    console.error(`\n❌ TEST RUN FAILED: ${summary.failedTests} tests failed.`);
    process.exit(1);
  } else {
    console.log(`\n✅ ALL ${summary.totalTests} TESTS PASSED SUCCESSFULLY across all 4 tiers!`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error executing test suite:', err);
  process.exit(1);
});
