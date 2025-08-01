#!/usr/bin/env node

/**
 * Build script for Cloudflare Workers deployment
 * Generates assets manifest and prepares worker files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DIST_DIR = path.join(projectRoot, 'dist');
const WORKER_DIR = path.join(projectRoot, 'worker');

/**
 * Read file as base64 for binary files or as text for text files
 */
function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
  
  if (binaryExtensions.includes(ext)) {
    return fs.readFileSync(filePath, 'base64');
  } else {
    return fs.readFileSync(filePath, 'utf-8');
  }
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push({
        path: relativePath,
        fullPath: fullPath,
      });
    }
  }
  
  return files;
}

/**
 * Generate assets manifest
 */
function generateAssetsManifest() {
  console.log('Generating assets manifest...');
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist directory not found. Please run "npm run build" first.');
    process.exit(1);
  }
  
  const files = getAllFiles(DIST_DIR);
  const manifest = {};
  
  for (const file of files) {
    try {
      const content = readFileContent(file.fullPath);
      manifest[file.path] = content;
      console.log(`Added to manifest: ${file.path}`);
    } catch (error) {
      console.error(`Error reading file ${file.path}:`, error.message);
    }
  }
  
  // Ensure worker directory exists
  if (!fs.existsSync(WORKER_DIR)) {
    fs.mkdirSync(WORKER_DIR, { recursive: true });
  }
  
  // Write manifest
  const manifestPath = path.join(WORKER_DIR, 'assets-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`Assets manifest generated: ${manifestPath}`);
  console.log(`Total files: ${Object.keys(manifest).length}`);
}

/**
 * Copy worker files
 */
function copyWorkerFiles() {
  console.log('Copying worker files...');
  
  // The main worker file is already in place
  // Just ensure it exists
  const workerIndexPath = path.join(WORKER_DIR, 'index.js');
  if (!fs.existsSync(workerIndexPath)) {
    console.error('Error: worker/index.js not found.');
    process.exit(1);
  }
  
  console.log('Worker files ready.');
}

/**
 * Main build function
 */
function main() {
  console.log('Building for Cloudflare Workers...');
  
  try {
    generateAssetsManifest();
    copyWorkerFiles();
    
    console.log('✅ Worker build completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Deploy with: npx wrangler deploy');
    console.log('2. Or preview with: npx wrangler dev');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();
