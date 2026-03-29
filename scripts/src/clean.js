const fs = require('fs');
const path = require('path');

const targets = ['data', 'contributions/markdown-generated', 'contributions/html-generated'];

const cleanFolder = (dirPath, isRoot = true) => {
  if (!fs.existsSync(dirPath)) return;

  const items = fs.readdirSync(dirPath);

  items.forEach((item) => {
    const fullPath = path.join(dirPath, item);

    if (fs.statSync(fullPath).isDirectory()) {
      // Recursively clean subfolders
      cleanFolder(fullPath, false);
      // Delete the subfolder itself once empty
      if (fs.readdirSync(fullPath).length === 0) {
        fs.rmdirSync(fullPath);
        console.log(`📂 Removed Folder: ${fullPath}`);
      }
    } else {
      // Delete files, but protect .gitkeep in the root directory
      if (isRoot && item === '.gitkeep') {
        return;
      }
      fs.unlinkSync(fullPath);
      console.log(`🗑️ Deleted File: ${fullPath}`);
    }
  });
};

console.log('🧹 Deep cleaning generated folders...');
targets.forEach((target) => {
  const resolvedPath = path.resolve(target);
  cleanFolder(resolvedPath, true);
});
console.log('✨ Clean complete! Root folders and .gitkeep files preserved.');
