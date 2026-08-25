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
  let newContent = content;

  // We want to replace `.message` back with `err.message` or `error.message`.
  // To be perfectly safe, since the original code was either `err.response?.data?.message` or `error.response?.data?.message`, let's just do:
  // Find `catch (xxx)` and replace `.message` with `xxx.message` inside its block? 
  // Actually, we can just revert the whole repository using git checkout to reset all files to HEAD!
  // Yes! The user hasn't committed my changes yet. So I can just do `git checkout -- .` to discard ALL my uncommitted changes, including the broken node script replacements!
  // Wait, I ALSO made changes to api.js that they reverted, but wait, `git checkout -- .` will wipe EVERYTHING that wasn't committed!
});
