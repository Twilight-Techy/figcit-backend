#!/usr/bin/env node
// Commands: `snapshot` (workbook → snapshot JSON) and `fixtures` (workbook → engine fixtures).
// Implemented in backend issues #8 and #9.
const command = process.argv[2];

process.stderr.write(
  `figcit-rules: "${command ?? ''}" is not implemented yet (see issues #8, #9)\n`,
);
process.exitCode = 1;
