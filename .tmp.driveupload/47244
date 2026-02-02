
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

// Try to find API key
let apiKey = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: Could not find API Key in .env or environment variables.");
    process.exit(1);
}

console.log(`Checking models with API Key: ${apiKey.substring(0, 10)}...`);

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("API Error:", json.error);
            } else {
                console.log("Available Models:");
                const models = json.models || [];
                models.forEach(m => {
                    console.log(`- ${m.name} (${m.supportedGenerationMethods?.join(', ')})`);
                });

                // Check for specific models
                const imagenModels = models.filter(m => m.name.includes('imagen'));
                console.log("\nImagen Models found:", imagenModels.map(m => m.name));
            }
        } catch (e) {
            console.error("Failed to parse response:", e);
            console.log("Raw response:", data);
        }
    });
}).on('error', (e) => {
    console.error("Request failed:", e);
});
