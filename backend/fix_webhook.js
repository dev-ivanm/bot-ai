const fetch = globalThis.fetch;

async function fix() {
    console.log("Fixing webhook url for Ventas-Pruebas...");
    const res = await fetch('http://localhost:8080/webhook/set/Ventas-Pruebas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': '42244224' },
        body: JSON.stringify({
            webhook: {
                enabled: true,
                url: 'http://host.docker.internal:3001/api/webhook/evolution',
                webhook_by_events: false,
                webhook_base64: false,
                events: [ "MESSAGES_UPSERT", "MESSAGES_SET", "MESSAGES_UPDATE", "MESSAGES_DELETE", "SEND_MESSAGE", "CONNECTION_UPDATE", "PRESENCE_UPDATE", "CHATS_UPDATE", "CHATS_SET", "CHATS_UPSERT", "CONTACTS_UPDATE", "CONTACTS_SET", "CONTACTS_UPSERT", "CALL" ]
            }
        })
    });
    console.log(await res.text());
}
fix();
