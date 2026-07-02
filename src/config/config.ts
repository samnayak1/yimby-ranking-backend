import fs from 'fs';
import path from 'path';

interface Options {
  designations:     string[];
  politicalLeanings: string[];
  currencies:       string[];
}

function loadOptions(): Options {
  const configPath = process.env.OPTIONS_PATH
    ?? path.join(__dirname, '../../config/options.json');

  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as Options;
}

// Read once at startup
export const options = loadOptions();