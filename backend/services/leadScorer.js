const { getDeepSeekResponse } = require('./deepseek');
const supabase = require('./supabase');
const { notifyHotLead } = require('./notifications');

/**
 * Analiza una conversación para obtener probabilidad de compra y satisfacción.
 * @param {string} leadId - ID del lead en la tabla public.leads
 */
async function scoreLead(leadId) {
    try {
        console.log(`[Lead-Scorer] Iniciando análisis para Lead: ${leadId}`);

        // 1. Obtener los datos del lead y el ID de la empresa
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (leadError || !lead) throw new Error("Lead no encontrado");

        // 2. Obtener los últimos 15 mensajes del chat
        const { data: mensajes, error: msgError } = await supabase
            .from('mensajes_wa')
            .select('mensaje_texto, es_mio, created_at')
            .eq('remote_jid', `${lead.telefono}@s.whatsapp.net`)
            .order('created_at', { ascending: false })
            .limit(15);

        if (msgError || !mensajes || mensajes.length === 0) {
            console.log("[Lead-Scorer] No hay suficientes mensajes para analizar.");
            return null;
        }

        // 3. Preparar el historial para la IA (orden cronológico)
        const historialFormateado = mensajes.reverse().map(m => 
            `${m.es_mio ? 'BOT' : 'CLIENTE'}: ${m.mensaje_texto}`
        ).join('\n');

        // 4. Definir el prompt de análisis
        const scoringPrompt = `Analiza la siguiente conversación de WhatsApp entre un bot de ventas/atención y un cliente.
Determina la probabilidad de compra y el nivel de satisfacción.

[CRITERIOS DE EVALUACIÓN]:
1. Intención: ¿Pregunta por precios, stock, métodos de pago?
2. Urgencia: ¿Lo necesita pronto?
3. Satisfacción: ¿Tono positivo, agradecido o frustrado?
4. Sentimiento: Positivo, Neutro o Negativo.

[IMPORTANTE]: Responde ÚNICAMENTE en formato JSON válido. No incluyas texto extra.

[RESULTADO ESPERADO]:
{
  "probabilidad": integer (0-100),
  "satisfaccion": integer (1-5),
  "sentimiento": "positivo|neutro|negativo",
  "estado": "prospecto|interesado|cliente",
  "resumen": "string corto (máx 10 palabras) sobre el interés principal",
  "motivo": "string breve de por qué este puntaje"
}

[HISTORIAL DE CHAT]:
${historialFormateado}`;

        // 5. Llamar a la IA
        const responseText = await getDeepSeekResponse(scoringPrompt, []);
        
        // Limpiamos la respuesta por si la IA añade markdown (```json ...)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("La IA no devolvió un JSON válido");
        
        const result = JSON.parse(jsonMatch[0]);

        // 6. Actualizar el Lead en Supabase
        const { error: updateError } = await supabase
            .from('leads')
            .update({
                probabilidad_compra: result.probabilidad,
                nivel_satisfaccion: result.satisfaccion,
                sentimiento_actual: result.sentimiento,
                estado: result.estado,
                resumen_interes: result.resumen
            })
            .eq('id', leadId);

        if (updateError) throw updateError;

        console.log(`[Lead-Scorer] Análisis completado para ${lead.telefono}: ${result.probabilidad}% prob, ${result.satisfaccion}/5 sat.`);

        // Disparar notificación si es Hot Lead
        if (result.probabilidad >= 80) {
            const { data: userData } = await supabase.from('perfiles_usuario').select('empresa_id').eq('id', lead.agente_id).single();
            await notifyHotLead(userData?.empresa_id, lead.nombre || lead.telefono, result.probabilidad);
        }

        return result;

    } catch (err) {
        console.error("[Lead-Scorer] Error analizando lead:", err.message);
        throw err;
    }
}

module.exports = { scoreLead };
