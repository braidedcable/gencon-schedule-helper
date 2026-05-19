import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const GENCON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GenConVacancyChecker/1.0)',
}

async function checkEvent(eventId: string): Promise<boolean | null> {
  const m = eventId.match(/\d+$/)
  if (!m) return null
  try {
    const r = await fetch(`https://www.gencon.com/events/${m[0]}`, {
      headers: GENCON_HEADERS,
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const text = await r.text()
    return /this event is sold out/i.test(text)
  } catch (e) {
    console.error(`${eventId}: fetch error —`, e)
    return null
  }
}

async function pruneStaleWatches(cutoffDays = 30) {
  const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await sb.from('vacancy_watches').delete().lt('last_seen', cutoff).select()
  if (data?.length) console.log(`Pruned ${data.length} stale watch row(s).`)
}

Deno.serve(async (_req) => {
  try {
    await pruneStaleWatches()

    const { data: rows, error } = await sb.from('vacancy_watches').select('event_id')
    if (error) throw error

    const eventIds = [...new Set((rows ?? []).map(r => r.event_id))]

    if (!eventIds.length) {
      return Response.json({ message: 'No events being watched.' })
    }

    console.log(`Checking ${eventIds.length} event(s)...`)
    const nowIso = new Date().toISOString()
    let updated = 0

    for (const eventId of eventIds) {
      const soldOut = await checkEvent(eventId)
      if (soldOut === null) continue
      await sb.from('vacancy_watches')
        .update({ sold_out: soldOut, last_checked: nowIso })
        .eq('event_id', eventId)
      console.log(`  ${eventId}: ${soldOut ? 'SOLD OUT' : 'AVAILABLE'}`)
      updated++
      await new Promise(r => setTimeout(r, 500))
    }

    return Response.json({ checked: eventIds.length, updated })
  } catch (e) {
    console.error(e)
    return Response.json({ error: String(e) }, { status: 500 })
  }
})
