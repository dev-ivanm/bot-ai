const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api/whatsapp';
const IDs = {
    Admin: '6174ffe3-f360-4af1-b6f4-9634ce157ba6',
    Agent: '0f3cb539-cb5a-4e57-9ec1-052bc851519c',
    Wrong: '00000000-0000-0000-0000-000000000000'
};

async function testApi() {
    console.log("=== TESTING BACKEND API ISOLATION ===");
    
    for (const [name, id] of Object.entries(IDs)) {
        console.log(`\nTesting for ${name} (ID: ${id})...`);
        const res = await fetch(`${API_BASE}/memory?userId=${id}`);
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            console.log(`Results count: ${data.length}`);
            if (data.length > 0) {
                console.log(`First entry owner (if present): ${data[0].user_id}`);
            }
        } else {
            console.log(`Error: ${JSON.stringify(data)}`);
        }
    }

    console.log(`\nTesting with NO userId...`);
    const resNoId = await fetch(`${API_BASE}/memory`);
    const dataNoId = await resNoId.json();
    console.log(`Status: ${resNoId.status}`);
    console.log(`Response: ${JSON.stringify(dataNoId)}`);
}

testApi();
