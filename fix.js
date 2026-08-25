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
  
  // The powershell script accidentally replaced `err.response?.data?.message` with `.message`
  // We can look for specific patterns to fix this.
  // E.g., `showError(.message` -> `showError(err.message`
  // E.g., `error(.message` -> `error(err.message`
  // E.g., `addToast(.message` -> `addToast(error.message` // wait, was it err or error?
  // Let's just fix it by looking at the catch block parameter.
  
  // A safer regex: find catch (err) { ... .message ... }
  // Since we only modified 16 files, and they all had this issue.
  // Actually, we can just look for ` .message` or `(.message`
  
  let newContent = content.replace(/\(\.message/g, '(err.message');
  newContent = newContent.replace(/= \.message/g, '= err.message');
  newContent = newContent.replace(/\? \.message/g, '? err.message');
  newContent = newContent.replace(/: \.message/g, ': err.message');
  newContent = newContent.replace(/\|\| \.message/g, '|| err.message');

  // Some components might have used `error` instead of `err` for the catch variable. 
  // If we look at the catch block, we can be smart, or just assume `err` or `error` is fine if we just match what's declared.
  // Let's use a regex to find the catch variable and replace `.message` inside it.
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
    console.log('Fixed:', file);
  }
});

console.log('Total files fixed:', changedFiles);
