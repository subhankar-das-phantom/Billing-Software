const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('d:/SIDE PROJECTS/Billing Software/frontend/src');
let changedFiles = 0;

files.forEach(file => {
  if (file.endsWith('api.js')) return;

  const content = fs.readFileSync(file, 'utf8');
  // In javascript, $1 maps to the first capture group!
  const newContent = content.replace(/(err|error)\.response\?\.data\?\.message/g, '$1.message');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
    console.log('Fixed:', file);
  }
});

console.log('Total files fixed:', changedFiles);
