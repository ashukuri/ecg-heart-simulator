import { createServer } from 'vite';

async function main() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    const mod = await server.ssrLoadModule('/src/utils/ecgValidation.ts');
    const report = mod.runFullEcgValidationSuite();

    console.log('================================================================================');
    console.log(' ECG Heart Simulator - 12-Lead Medical & Mathematical Validation Suite');
    console.log('================================================================================');
    console.log(
      `Diseases: ${report.totalDiseases} | Leads/Disease: ${report.totalLeadsPerDisease} | Samples/Lead: ${report.samplesPerLead} (500 Hz)`
    );
    console.log(
      `Global Max |V|: ${report.maxAbsMv.toFixed(3)} mV (${report.maxAbsMvDiseaseId}.${report.maxAbsMvLeadId}) | Max Limb-Lead Identity Error: ${report.maxLimbErrorMv.toExponential(3)} mV`
    );
    console.log('--------------------------------------------------------------------------------');

    for (const c of report.checks) {
      const status = c.passed ? '[PASS]' : '[FAIL]';
      console.log(`${status} #${String(c.id).padStart(2, '0')} ${c.name}`);
      console.log(`       -> ${c.detail}`);
    }

    console.log('================================================================================');
    if (report.allPassed) {
      console.log(`ALL ${report.checks.length} VALIDATION CHECKS PASSED SUCCESSFULLY (0 failures).`);
      process.exitCode = 0;
    } else {
      console.error('VALIDATION FAILED: One or more checks did not pass.');
      process.exitCode = 1;
    }
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
