async function testApi() {
    const userId = '0f3cb539-cb5a-4e57-9ec1-052bc851519c';
    const url = `http://localhost:3001/api/whatsapp/profile/me?userId=${userId}`;
    
    console.log(`--- Testing API for User ID: ${userId} ---`);
    console.log(`URL: ${url}`);

    try {
        const response = await fetch(url);
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response Body:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error calling API:', error.message);
    }
}

testApi();
