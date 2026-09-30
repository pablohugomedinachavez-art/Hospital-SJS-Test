// src/services/chatService.js

/**
 * Obtiene una sala de chat existente entre dos usuarios o crea una nueva si no existe,
 * evitando la duplicación de salas en Supabase.
 * 
 * @param {Object} supabase - Instancia del cliente de Supabase
 * @param {string} currentUserId - ID del usuario actual
 * @param {string} targetUserId - ID del usuario con el que se desea chatear
 * @param {string} tenantId - ID de la organización o inquilino actual
 * @returns {Object|null} La sala de chat existente o la nueva creada
 */
export async function getOrCreateChatRoom(supabase, currentUserId, targetUserId, tenantId) {
  if (!supabase || !currentUserId || !targetUserId) {
    console.error('Faltan parámetros requeridos para obtener o crear la sala de chat.');
    return null;
  }

  try {
    // 1. Buscar si ya existe una sala entre ambos (en cualquier orden de participantes)
    const { data: existingRooms, error: searchError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${currentUserId})`);

    if (searchError) {
      console.error('Error al buscar sala existente en Supabase:', searchError.message);
      return null;
    }

    if (existingRooms && existingRooms.length > 0) {
      // Retornar la sala ya existente para evitar duplicados
      return existingRooms[0];
    }

    // 2. Si no existe, crear una nueva sala única
    const { data: newRoom, error: createError } = await supabase
      .from('chat_rooms')
      .insert([{
        tenant_id: tenantId,
        user1_id: currentUserId,
        user2_id: targetUserId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error al crear nueva sala de chat en Supabase:', createError.message);
      return null;
    }

    return newRoom;
  } catch (err) {
    console.error('Excepción inesperada en getOrCreateChatRoom:', err);
    return null;
  }
}