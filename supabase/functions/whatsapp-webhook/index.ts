import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const { event, instance, data } = body

    console.log(`Evento recibido: ${event} para instancia: ${instance}`)

    if (!instance || !data) {
      return new Response(JSON.stringify({ error: "No data" }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Buscar el perfil asociado a la instancia
    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles_bot')
      .select('id')
      .eq('instance_name', instance)
      .single()

    if (perfilError || !perfil) {
      console.error(`Error buscando perfil para ${instance}:`, perfilError)
      return new Response(JSON.stringify({ error: "Perfil no encontrado" }), { status: 404 })
    }

    // 2. Procesar el evento
    if (event === 'MESSAGES_UPSERT') {
      const message = data.message
      const key = data.key
      const isFromMe = key.fromMe
      const remoteJid = key.remoteJid
      const pushName = data.pushName || ""
      
      const text = message?.conversation || 
                   message?.extendedTextMessage?.text || 
                   message?.imageMessage?.caption || 
                   message?.videoMessage?.caption || 
                   "Mensaje multimedia"

      console.log(`Guardando mensaje de ${remoteJid}: ${text.substring(0, 50)}...`)

      const { error: insertError } = await supabase
        .from('mensajes_wa')
        .insert({
          perfil_id: perfil.id,
          remote_jid: remoteJid,
          nombre_contacto: pushName,
          mensaje_texto: text,
          es_mio: isFromMe,
          created_at: new Date().toISOString()
        })

      if (insertError) {
        console.error("Error insertando mensaje:", insertError)
        return new Response(JSON.stringify({ error: insertError.message }), { status: 500 })
      }

      // 3. Sincronizar tabla de LEADS (solo si no es mio)
      if (!isFromMe) {
        console.log(`Sincronizando Lead para ${remoteJid}...`)
        
        // Obtener empresa_id del usuario (perfil.id es el user_id)
        const { data: userData } = await supabase
          .from('perfiles_usuario')
          .select('empresa_id')
          .eq('id', perfil.id)
          .single()

        const empresaId = userData?.empresa_id

        // Upsert del Lead
        const { error: leadError } = await supabase
          .from('leads')
          .upsert({
            empresa_id: empresaId,
            agente_id: perfil.id,
            telefono: remoteJid.split('@')[0],
            nombre: pushName || remoteJid.split('@')[0],
            ultimo_contacto: new Date().toISOString()
          }, { 
            onConflict: 'telefono, empresa_id' 
          })

        if (leadError) {
          console.error("Error actualizando Lead:", leadError)
        }
      }
    } 
    else if (event === 'CHATS_DELETE') {
      // Eliminar historial de mensajes para este chat si el usuario lo borra en WA
      const jids = data || []
      console.log(`Eliminando historial para chats: ${jids.join(', ')}`)
      
      const { error: deleteError } = await supabase
        .from('mensajes_wa')
        .delete()
        .eq('perfil_id', perfil.id)
        .in('remote_jid', jids)

      if (deleteError) console.error("Error eliminando chats:", deleteError)
    }
    else if (event === 'MESSAGES_DELETE') {
      const id = data.id
      console.log(`Eliminando mensaje individual: ${id}`)
      
      const { error: deleteError } = await supabase
        .from('mensajes_wa')
        .delete()
        .eq('perfil_id', perfil.id)
        .eq('id', id)

      if (deleteError) console.error("Error eliminando mensaje:", deleteError)
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    })

  } catch (error) {
    console.error("Error procesando webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
