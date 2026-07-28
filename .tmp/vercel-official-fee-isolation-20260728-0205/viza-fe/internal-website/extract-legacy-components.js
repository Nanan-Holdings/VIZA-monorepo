const fs = require('fs');
const path = require('path');

// Read the compiled chunk
const chunkPath = '.next/dev/static/chunks/_ebc41dad._.js';
const content = fs.readFileSync(chunkPath, 'utf-8');

// Function to extract and reconstruct a component
function extractComponent(content, componentPath) {
  const escapedPath = componentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Find the section for this component
  const regex = new RegExp(`"\\[project\\]/${escapedPath} \\[app-client\\] \\(ecmascript\\)"[^}]*?\\{([\\s\\S]*?)^\\}\\)?\\n\\]\\)`, 'm');
  const match = content.match(regex);
  
  if (!match) {
    console.log(`Could not find ${componentPath}`);
    return null;
  }
  
  let code = match[1];
  
  // Basic cleanup of the compiled code
  code = code
    // Remove Turbopack context wrappers
    .replace(/__TURBOPACK__[^_]*__/g, '')
    .replace(/\["jsxDEV"\]/g, '')
    .replace(/\["jsx"\]/g, '')
    .replace(/\["Fragment"\]/g, 'Fragment')
    // Clean up imports
    .replace(/\$5b\$project\$5d2f/g, '')
    .replace(/\$2f/g, '/')
    .replace(/\$2d/g, '-')
    .replace(/\$2e/g, '.')
    .replace(/\$5d/g, '')
    .replace(/\$5b/g, '')
    .replace(/\$3c/g, '<')
    .replace(/\$3e/g, '>')
    .replace(/\$28/g, '(')
    .replace(/\$29/g, ')')
    .replace(/\$3a/g, ':')
    .replace(/__turbopack_context__\.i\(/g, 'import')
    .replace(/fileName: "\[project\][^"]*",?\s*/g, '')
    .replace(/lineNumber: \d+,?\s*/g, '')
    .replace(/columnNumber: \d+,?\s*/g, '')
    .replace(/\/\*#__PURE__\*\//g, '')
    .replace(/, void 0, (false|true)/g, '')
    .replace(/, this\)/g, ')')
    .replace(/\{([^}]*)\}, \{/g, '{$1}, {')
    .trim();
  
  return code;
}

// Components to extract
const components = [
  'app/client/report/legacy-page.tsx',
  'components/client/legacy-report-bio-marker-card.tsx',
  'components/client/legacy-report-section-summary-card.tsx',
  'components/client/legacy-report-bio-marker-item.tsx',
  'components/client/legacy-report-profile-card.tsx',
];

// Extract each component
components.forEach(comp => {
  console.log(`\n=== Extracting ${comp} ===\n`);
  const code = extractComponent(content, comp);
  if (code) {
    const outputPath = path.join('/tmp', path.basename(comp));
    fs.writeFileSync(outputPath, code);
    console.log(`Saved to ${outputPath}`);
    console.log(`First 500 chars:\n${code.substring(0, 500)}...\n`);
  }
});
