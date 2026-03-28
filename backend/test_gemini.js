const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables desde el .env local (estando en /backend)
const envPath = path.join(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const API_KEY = envConfig.OPENROUTER_API_KEY;
const MODEL = envConfig.OPENROUTER_MODEL || "google/gemma-3-4b-it:free";

async function test() {
    console.log("🔍 Probando conectividad con OpenRouter...");
    console.log("Model:", MODEL);
    
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'HTTP-Referer': 'https://maxitiendas.bot',
                'X-Title': 'Test Bot'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: "user", content: "Hola, responde con la palabra 'CONECTADO'." }]
            })
        });

        console.log(`Status: ${resp.status}`);
        if (resp.ok) {
            const data = await resp.json();
            console.log("✅ ÉXITO! Respuesta:", data.choices[0].message.content);
        } else {
            const err = await resp.text();
            console.log(`❌ FALLO: ${err.substring(0, 500)}`);
        }
    } catch (e) {
        console.log(`❌ ERROR: ${e.message}`);
    }
}

test();
