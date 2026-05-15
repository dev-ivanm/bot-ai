const { google } = require('googleapis');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
);

oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

console.log("Intentando refrescar token...");
oauth2Client.getAccessToken()
    .then(res => {
        console.log("✅ ¡ÉXITO! Token obtenido correctamente.");
        console.log("Access Token:", res.token.substring(0, 10) + "...");
    })
    .catch(err => {
        console.error("❌ ERROR DE GOOGLE:");
        console.error("Mensaje:", err.message);
        if (err.response) {
            console.error("Detalles:", err.response.data);
        }
    });
