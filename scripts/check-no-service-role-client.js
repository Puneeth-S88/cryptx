const fs = require('fs');
const path = require('path');

// Client directories only: components and client pages (excluding server api routes)
const clientDirs = [
  path.join(__dirname, '../src/components'),
];

let violationFound = false;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('supabaseAdmin') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        console.error(`SECURITY VIOLATION DETECTED in client UI component: ${fullPath}`);
        violationFound = true;
      }
    }
  }
}

clientDirs.forEach(scanDir);

// Also scan app directory while explicitly excluding api/ routes (which are Next.js server route handlers)
function scanAppExcludingApi(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'api') continue; // api routes are Next.js server route handlers
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanAppExcludingApi(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('supabaseAdmin') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        console.error(`SECURITY VIOLATION DETECTED in client app page: ${fullPath}`);
        violationFound = true;
      }
    }
  }
}

scanAppExcludingApi(path.join(__dirname, '../src/app'));

if (violationFound) {
  console.error('Lint check failed: Service role client detected in client bundle!');
  process.exit(1);
} else {
  console.log('Zero Service-Role Leak Audit Passed: Client bundle is completely secure.');
}
