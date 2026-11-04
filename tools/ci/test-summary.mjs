import { appendFileSync, readFileSync } from 'node:fs';

const [label, file] = process.argv.slice(2);
const report = JSON.parse(readFileSync(file, 'utf8'));
const summary = `### ${label}\n\n| Passed | Failed | Skipped | Total |\n| ---: | ---: | ---: | ---: |\n| ${report.numPassedTests} | ${report.numFailedTests} | ${report.numPendingTests} | ${report.numTotalTests} |\n\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
