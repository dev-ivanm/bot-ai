const http = require('http');

const IDs = {
    Admin: '6174ffe3-f360-4af1-b6f4-9634ce157ba6',
    Agent: '0f3cb539-cb5a-4e57-9ec1-052bc851519c',
    Wrong: '00000000-0000-0000-0000-000000000000'
};

function test(name, id) {
    return new Promise((resolve) => {
        const url = `http://localhost:3001/api/whatsapp/memory?userId=${id}`;
        console.log(`\nTesting for ${name} (ID: ${id})...`);
        
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode === 200) {
                        console.log(`Results count: ${json.length}`);
                        if (json.length > 0) {
                            console.log(`First entry owner: ${json[0].user_id}`);
                        }
                    } else {
                        console.log(`Error: ${JSON.stringify(json)}`);
                    }
                } catch (e) {
                    console.log(`Parse error: ${data}`);
                }
                resolve();
            });
        }).on('error', (err) => {
            console.error(`Request error: ${err.message}`);
            resolve();
        });
    });
}

async function run() {
    console.log("=== TESTING BACKEND API ISOLATION (NATIVE) ===");
    await test('Admin', IDs.Admin);
    await test('Agent', IDs.Agent);
    await test('Wrong', IDs.Wrong);
    await test('No ID', '');
}

run();
