
const apiKey = "AIzaSyDGeiJ6jEMMh3fecYhOTRJoPPOmxdowoHM";

async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models) {
      console.log("Available Models:");
      data.models.forEach(m => {
        if (m.name.includes('imagen') || m.supportedGenerationMethods?.includes('generateImages')) {
             console.log(`- ${m.name} (${m.supportedGenerationMethods})`);
        }
      });
      
      console.log("\nAll Models (names only):");
      data.models.forEach(m => console.log(m.name));
    } else {
      console.log("No models found or error:", data);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

listModels();
