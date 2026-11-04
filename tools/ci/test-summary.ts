import { appendFileSync, readFileSync } from 'node:fs';

const [label, file] = process.argv.slice(2);
if (!label || !file) throw new Error('usage: test-summary.ts <label> <report.json>');
const report: unknown = JSON.parse(readFileSync(file, 'utf8'));
if (typeof report !== 'object' || report === null
  || !('numPassedTests' in report) || typeof report.numPassedTests !== 'number'
  || !('numFailedTests' in report) || typeof report.numFailedTests !== 'number'
  || !('numPendingTests' in report) || typeof report.numPendingTests !== 'number'
  || !('numTotalTests' in report) || typeof report.numTotalTests !== 'number') {
  throw new Error('Expected a Vitest JSON report containing numeric passed, failed, pending and total counts');
}
const summary = `### ${label}\n\n| Passed | Failed | Skipped | Total |\n| ---: | ---: | ---: | ---: |\n| ${report.numPassedTests} | ${report.numFailedTests} | ${report.numPendingTests} | ${report.numTotalTests} |\n\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
