const SUPABASE_URL = 'https://wzowdavksnwsvhsyjamx.supabase.co'
const SUPABASE_KEY = 'sb_publishable_8U2Cy-UyVSdYFi4gRW77ZA_ls3zMX4I'

const TYPE_COLORS = {
  BGM: '#059669', RPG: '#dc2626', CGM: '#0891b2', TCG: '#2563eb',
  ESC: '#7c3aed', NMN: '#b45309', TDA: '#be185d', ZED: '#475569',
  WKS: '#0369a1', MHE: '#92400e', EGM: '#16a34a', SEM: '#1d4ed8',
  SPA: '#6b7280', HMN: '#78350f', KID: '#d97706', LRP: '#9333ea',
  ENT: '#db2777', FLM: '#b91c1c', TRD: '#64748b',
}

const TYPE_LABELS = {
  BGM: 'Board Game',
  RPG: 'RPG',
  CGM: 'Card Game',
  TCG: 'Trading Card',
  ESC: 'Escape Room',
  NMN: 'Miniatures',
  TDA: 'True Dungeon',
  ZED: 'Other',
  WKS: 'Workshop',
  MHE: 'Mini Hobby',
  EGM: 'Video Game',
  SEM: 'Seminar',
  SPA: 'Activity',
  HMN: 'Hist. Minis',
  KID: 'Kids',
  LRP: 'LARP',
  ENT: 'Entertainment',
  FLM: 'Film',
  TRD: 'Trade Day',
}

const DAY_LABELS = {
  '2026-07-30': 'Thursday, July 30',
  '2026-07-31': 'Friday, July 31',
  '2026-08-01': 'Saturday, August 1',
  '2026-08-02': 'Sunday, August 2',
}

const DAY_SHORT = {
  '2026-07-30': 'Thu',
  '2026-07-31': 'Fri',
  '2026-08-01': 'Sat',
  '2026-08-02': 'Sun',
}

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const { createApp, ref, computed, watch, onMounted } = Vue

createApp({
  setup() {
    const loading = ref(true)
    const events  = ref([])
    const view    = ref('browse')
    const filtersOpen = ref(false)

    // ── Filters ──────────────────────────────────────────
    const search        = ref('')
    const searchActive  = ref('')
    const filterDay     = ref('all')
    const selectedTypes = ref(new Set())
    const maxCost       = ref(200)
    const openOnly      = ref(false)
    const showPicked    = ref(false)

    let debounceTimer
    watch(search, v => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => { searchActive.value = v }, 280)
    })

    const days = [
      { value: 'all',        label: 'All'  },
      { value: '2026-07-30', label: 'Thu'  },
      { value: '2026-07-31', label: 'Fri'  },
      { value: '2026-08-01', label: 'Sat'  },
      { value: '2026-08-02', label: 'Sun'  },
    ]

    const toggleType = code => {
      const s = new Set(selectedTypes.value)
      s.has(code) ? s.delete(code) : s.add(code)
      selectedTypes.value = s
    }

    const clearFilters = () => {
      search.value = ''
      searchActive.value = ''
      filterDay.value = 'all'
      selectedTypes.value = new Set()
      maxCost.value = 200
      openOnly.value = false
      showPicked.value = false
    }

    const activeFilterCount = computed(() => {
      let n = 0
      if (searchActive.value) n++
      if (filterDay.value !== 'all') n++
      if (selectedTypes.value.size) n += selectedTypes.value.size
      if (maxCost.value < 200) n++
      if (openOnly.value) n++
      if (showPicked.value) n++
      return n
    })

    // ── Event type summary (counts based on all filters except type) ──
    const filteredExcludingType = computed(() => {
      let r = events.value
      if (searchActive.value) {
        const q = searchActive.value.toLowerCase()
        r = r.filter(e =>
          e.title.toLowerCase().includes(q) ||
          e.sys.toLowerCase().includes(q)   ||
          e.gm.toLowerCase().includes(q)    ||
          e.desc.toLowerCase().includes(q)
        )
      }
      if (filterDay.value !== 'all')
        r = r.filter(e => e.start.startsWith(filterDay.value))
      if (maxCost.value < 200)
        r = r.filter(e => e.cost <= maxCost.value)
      if (openOnly.value)
        r = r.filter(e => e.tix > 0)
      if (showPicked.value)
        r = r.filter(e => myPicks.value.has(e.id))
      return r
    })

    const eventTypes = computed(() => {
      const counts = {}
      filteredExcludingType.value.forEach(e => {
        const code = e.type.substring(0, 3)
        counts[code] = (counts[code] || 0) + 1
      })
      return Object.entries(counts)
        .map(([code, count]) => ({ code, count, color: TYPE_COLORS[code] || '#6b7280', label: TYPE_LABELS[code] || code }))
        .sort((a, b) => b.count - a.count)
    })

    // ── Filtering ─────────────────────────────────────────
    const filteredEvents = computed(() => {
      let r = events.value

      if (searchActive.value) {
        const q = searchActive.value.toLowerCase()
        r = r.filter(e =>
          e.title.toLowerCase().includes(q) ||
          e.sys.toLowerCase().includes(q)   ||
          e.gm.toLowerCase().includes(q)    ||
          e.desc.toLowerCase().includes(q)
        )
      }

      if (selectedTypes.value.size)
        r = r.filter(e => selectedTypes.value.has(e.type.substring(0, 3)))

      if (filterDay.value !== 'all')
        r = r.filter(e => e.start.startsWith(filterDay.value))

      if (maxCost.value < 200)
        r = r.filter(e => e.cost <= maxCost.value)

      if (openOnly.value)
        r = r.filter(e => e.tix > 0)

      if (showPicked.value)
        r = r.filter(e => myPicks.value.has(e.id))

      return r
    })

    const page     = ref(1)
    const PAGE_SZ  = 50

    watch(filteredEvents, () => { page.value = 1 })

    const displayedEvents = computed(() => filteredEvents.value.slice(0, page.value * PAGE_SZ))
    const hasMore         = computed(() => displayedEvents.value.length < filteredEvents.value.length)

    // ── My Picks ──────────────────────────────────────────
    const myPicks = ref(new Set(JSON.parse(localStorage.getItem('myPicks') || '[]')))

    const savePicks = () =>
      localStorage.setItem('myPicks', JSON.stringify([...myPicks.value]))

    const togglePick = async id => {
      const s      = new Set(myPicks.value)
      const adding = !s.has(id)
      adding ? s.add(id) : s.delete(id)
      myPicks.value = s
      savePicks()

      if (groupId.value && userName.value) {
        if (adding) {
          await sb.from('picks').insert({
            group_id: groupId.value, user_name: userName.value, event_id: id,
          })
        } else {
          await sb.from('picks').delete()
            .eq('group_id', groupId.value)
            .eq('user_name', userName.value)
            .eq('event_id', id)
        }
      }
    }

    // ── Schedule ──────────────────────────────────────────
    const mySchedule = computed(() =>
      events.value
        .filter(e => myPicks.value.has(e.id))
        .sort((a, b) => a.start.localeCompare(b.start))
    )

    const conflicts = computed(() => {
      const sched = mySchedule.value
      const ids   = new Set()
      for (let i = 0; i < sched.length; i++) {
        for (let j = i + 1; j < sched.length; j++) {
          if (sched[i].start < sched[j].end && sched[i].end > sched[j].start) {
            ids.add(sched[i].id)
            ids.add(sched[j].id)
          }
        }
      }
      return ids
    })

    const totalCost = computed(() => {
      const sum = mySchedule.value.reduce((t, e) => t + e.cost, 0)
      return Number.isInteger(sum) ? sum : sum.toFixed(2)
    })

    const scheduleDays = computed(() => {
      const byDay = {}
      mySchedule.value.forEach(e => {
        const d = e.start.substring(0, 10)
        ;(byDay[d] = byDay[d] || []).push(e)
      })
      return Object.entries(byDay).map(([date, evts]) => ({
        date,
        label: DAY_LABELS[date] || date,
        events: evts,
      }))
    })

    // ── Group ─────────────────────────────────────────────
    const userName      = ref(localStorage.getItem('userName')  || '')
    const groupName     = ref(localStorage.getItem('groupName') || '')
    const groupId       = ref(localStorage.getItem('groupId')   || '')
    const groupPicks    = ref({})   // { memberName: [eventId, …] }
    const inputUserName  = ref('')
    const inputGroupName = ref('')
    const groupLoading  = ref(false)
    const groupError    = ref('')
    let   realtimeCh    = null

    const joinOrCreateGroup = async () => {
      const uname = inputUserName.value.trim()
      const gname = inputGroupName.value.trim()
      if (!uname || !gname) return
      groupLoading.value = true
      groupError.value   = ''
      try {
        // Find existing group or create it
        let gid
        const { data: existing } = await sb.from('groups').select('id').eq('name', gname).maybeSingle()
        if (existing) {
          gid = existing.id
        } else {
          const { data: created, error } = await sb.from('groups').insert({ name: gname }).select('id').single()
          if (error) throw error
          gid = created.id
        }

        userName.value  = uname
        groupName.value = gname
        groupId.value   = gid
        localStorage.setItem('userName',  uname)
        localStorage.setItem('groupName', gname)
        localStorage.setItem('groupId',   gid)

        // Push existing picks to Supabase
        const existing_picks = [...myPicks.value].map(event_id => ({
          group_id: gid, user_name: uname, event_id,
        }))
        if (existing_picks.length) {
          await sb.from('picks').upsert(existing_picks, { onConflict: 'group_id,user_name,event_id' })
        }

        await loadGroupPicks()
        subscribeToGroup()
      } catch (err) {
        console.error(err)
        groupError.value = 'Could not connect. Try a different group name or check your connection.'
      } finally {
        groupLoading.value = false
      }
    }

    const leaveGroup = () => {
      if (realtimeCh) sb.removeChannel(realtimeCh)
      groupId.value   = ''
      groupName.value = ''
      userName.value  = ''
      groupPicks.value = {}
      localStorage.removeItem('groupId')
      localStorage.removeItem('groupName')
      localStorage.removeItem('userName')
    }

    const loadGroupPicks = async () => {
      if (!groupId.value) return
      const { data } = await sb.from('picks').select('user_name,event_id').eq('group_id', groupId.value)
      if (!data) return
      const picks = {}
      data.forEach(({ user_name, event_id }) => {
        ;(picks[user_name] = picks[user_name] || []).push(event_id)
      })
      groupPicks.value = picks
    }

    const subscribeToGroup = () => {
      if (realtimeCh) sb.removeChannel(realtimeCh)
      realtimeCh = sb.channel(`group-${groupId.value}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'picks',
          filter: `group_id=eq.${groupId.value}`,
        }, () => loadGroupPicks())
        .subscribe()
    }

    const isGroupPick = id =>
      Object.entries(groupPicks.value).some(([u, picks]) => u !== userName.value && picks.includes(id))

    const groupWantsCount = id =>
      Object.entries(groupPicks.value).filter(([u, picks]) => u !== userName.value && picks.includes(id)).length || null

    const sharedBy = id =>
      Object.entries(groupPicks.value).filter(([, picks]) => picks.includes(id)).map(([u]) => u)

    const sharedEvents = computed(() => {
      const allIds = Object.values(groupPicks.value).flat()
      const counts = {}
      allIds.forEach(id => { counts[id] = (counts[id] || 0) + 1 })
      const multi = new Set(Object.entries(counts).filter(([, c]) => c >= 2).map(([id]) => id))
      return events.value.filter(e => multi.has(e.id)).sort((a, b) => a.start.localeCompare(b.start))
    })

    const memberCost = member =>
      (groupPicks.value[member] || []).reduce((sum, id) => {
        const e = events.value.find(ev => ev.id === id)
        return sum + (e ? e.cost : 0)
      }, 0)

    // ── Modal ─────────────────────────────────────────────
    const selectedEvent = ref(null)

    const closeOnEsc = e => { if (e.key === 'Escape') selectedEvent.value = null }
    onMounted(() => window.addEventListener('keydown', closeOnEsc))

    // ── Formatting ────────────────────────────────────────
    const typeCode  = type => TYPE_LABELS[type.substring(0, 3)] || type.substring(0, 3)
    const typeColor = type => TYPE_COLORS[type.substring(0, 3)] || '#6b7280'

    const formatTime = dt => {
      if (!dt) return ''
      const [, , , hh, mm] = dt.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
      const h = parseInt(hh), m = mm
      const ampm = h < 12 ? 'am' : 'pm'
      const h12  = h % 12 || 12
      return m === '00' ? `${h12}${ampm}` : `${h12}:${m}${ampm}`
    }

    const formatDayShort = dt => dt ? (DAY_SHORT[dt.substring(0, 10)] || '') : ''
    const formatDayLong  = dt => dt ? (DAY_LABELS[dt.substring(0, 10)] || dt.substring(0, 10)) : ''

    // ── ICS Export ────────────────────────────────────────
    const exportICS = () => {
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//GenCon 2026 Schedule Helper//EN',
        'CALSCALE:GREGORIAN',
        'X-WR-CALNAME:GenCon 2026',
        'X-WR-TIMEZONE:America/Indiana/Indianapolis',
      ]

      mySchedule.value.forEach(e => {
        const toStamp = s => s.replace(/[-:T]/g, '').padEnd(15, '0').substring(0, 15)
        lines.push(
          'BEGIN:VEVENT',
          `DTSTART;TZID=America/Indiana/Indianapolis:${toStamp(e.start)}`,
          `DTEND;TZID=America/Indiana/Indianapolis:${toStamp(e.end)}`,
          `SUMMARY:${e.title}`,
          `DESCRIPTION:${(e.desc || '').replace(/\n/g, '\\n').replace(/,/g, '\\,')}`,
          `LOCATION:${e.loc}${e.room ? ' - ' + e.room : ''}`,
          `UID:${e.id}@gencon2026.schedule`,
          'END:VEVENT',
        )
      })

      lines.push('END:VCALENDAR')

      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), { href: url, download: 'gencon2026.ics' })
      a.click()
      URL.revokeObjectURL(url)
    }

    // ── Init ──────────────────────────────────────────────
    onMounted(async () => {
      const res    = await fetch('./events.json')
      events.value = await res.json()
      loading.value = false

      if (groupId.value) {
        await loadGroupPicks()
        subscribeToGroup()
      }
    })

    return {
      loading, events, view, filtersOpen,
      search, filterDay, selectedTypes, maxCost, openOnly, showPicked,
      days, eventTypes, filteredEvents, displayedEvents, hasMore, activeFilterCount,
      myPicks, togglePick, mySchedule, conflicts, totalCost, scheduleDays,
      userName, groupName, groupId, groupPicks,
      inputUserName, inputGroupName, groupLoading, groupError, sharedEvents,
      selectedEvent,
      toggleType, clearFilters,
      joinOrCreateGroup, leaveGroup, isGroupPick, groupWantsCount, sharedBy, memberCost,
      typeCode, typeColor, formatTime, formatDayShort, formatDayLong, exportICS,
      page,
    }
  },
}).mount('#app')
