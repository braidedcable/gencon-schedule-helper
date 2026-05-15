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
  BGM: 'Board Game',   RPG: 'RPG',          CGM: 'Card Game',
  TCG: 'Trading Card', ESC: 'Escape Room',  NMN: 'Miniatures',
  TDA: 'True Dungeon', ZED: 'Other',        WKS: 'Workshop',
  MHE: 'Mini Hobby',  EGM: 'Video Game',   SEM: 'Seminar',
  SPA: 'Activity',    HMN: 'Hist. Minis',  KID: 'Kids',
  LRP: 'LARP',        ENT: 'Entertainment', FLM: 'Film',
  TRD: 'Trade Day',
}

const EXP_LABELS = {
  "None (You've never played before - rules will be taught)": 'Beginner',
  "Some (You've played it a bit and understand the basics)":  'Some experience',
  'Expert (You play it regularly and know all the rules)':    'Expert',
}

const AGE_LABELS = {
  'Everyone (6+)':             'Everyone (6+)',
  'Teen (13+)':                'Teen (13+)',
  'Mature (18+)':              'Mature (18+)',
  '21+':                       '21+',
  'kids only (12 and under)':  'Kids (12 & under)',
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

// Normalize minor location typos in the source data
const normLoc = loc => {
  const l = (loc || '').trim()
  if (l.toLowerCase() === 'hilton') return 'Hilton'
  if (l.toLowerCase() === 'jw')     return 'JW'
  return l
}

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const { createApp, ref, computed, watch, nextTick, onMounted } = Vue

createApp({
  setup() {
    const loading     = ref(true)
    const events      = ref([])
    const view        = ref('browse')
    const filtersOpen = ref(false)
    const authUserId  = ref(null)

    // ── Filters ──────────────────────────────────────────
    const search           = ref('')
    const searchActive     = ref('')
    const ALL_DAYS = ['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']
    const filterDay        = ref(new Set(ALL_DAYS))
    const selectedTypes    = ref(new Set())
    const maxCost          = ref(200)
    const openOnly         = ref(false)
    const showPicked       = ref(false)
    // More filters
    const moreFiltersOpen  = ref(false)
    const selectedAges     = ref(new Set())
    const selectedExps     = ref(new Set())
    const maxDuration      = ref(10)
    const selectedVenues   = ref(new Set())
    const noMaterials      = ref(false)
    const noTournaments    = ref(false)

    let debounceTimer
    watch(search, v => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => { searchActive.value = v }, 280)
    })

    const days = [
      { value: '2026-07-30', label: 'Thu' },
      { value: '2026-07-31', label: 'Fri' },
      { value: '2026-08-01', label: 'Sat' },
      { value: '2026-08-02', label: 'Sun' },
    ]

    const toggleSet = (refVal, key) => {
      const s = new Set(refVal.value)
      s.has(key) ? s.delete(key) : s.add(key)
      refVal.value = s
    }

    const toggleDay   = date => {
      // Require at least one day selected
      const s = new Set(filterDay.value)
      if (s.has(date) && s.size === 1) return
      s.has(date) ? s.delete(date) : s.add(date)
      filterDay.value = s
    }
    const toggleType  = code => toggleSet(selectedTypes,  code)
    const toggleAge   = age  => toggleSet(selectedAges,   age)
    const toggleExp   = exp  => toggleSet(selectedExps,   exp)
    const toggleVenue = v    => toggleSet(selectedVenues, v)

    const clearFilters = () => {
      search.value         = ''
      searchActive.value   = ''
      filterDay.value      = new Set(ALL_DAYS)
      selectedTypes.value  = new Set()
      maxCost.value        = 200
      openOnly.value       = false
      showPicked.value     = false
      selectedAges.value   = new Set()
      selectedExps.value   = new Set()
      maxDuration.value    = 10
      selectedVenues.value = new Set()
      noMaterials.value    = false
      noTournaments.value  = false
    }

    const activeFilterCount = computed(() => {
      let n = 0
      if (searchActive.value)       n++
      if (filterDay.value.size < ALL_DAYS.length) n++
      n += selectedTypes.value.size
      if (maxCost.value < 200)       n++
      if (openOnly.value)            n++
      if (showPicked.value)          n++
      n += selectedAges.value.size
      n += selectedExps.value.size
      if (maxDuration.value < 10)    n++
      n += selectedVenues.value.size
      if (noMaterials.value)         n++
      if (noTournaments.value)       n++
      return n
    })

    const moreFilterCount = computed(() => {
      let n = 0
      n += selectedAges.value.size
      n += selectedExps.value.size
      if (maxDuration.value < 10)    n++
      n += selectedVenues.value.size
      if (noMaterials.value)         n++
      if (noTournaments.value)       n++
      return n
    })

    // ── Base filter (everything except event type) ────────
    // Used both for type chip counts and as the base for filteredEvents.
    const applyBaseFilters = arr => {
      let r = arr
      if (searchActive.value) {
        const q = searchActive.value.toLowerCase()
        r = r.filter(e =>
          e.title.toLowerCase().includes(q) ||
          e.sys.toLowerCase().includes(q)   ||
          e.gm.toLowerCase().includes(q)    ||
          e.grp.toLowerCase().includes(q)   ||
          e.desc.toLowerCase().includes(q)
        )
      }
      if (filterDay.value.size < ALL_DAYS.length)
        r = r.filter(e => filterDay.value.has(e.start.substring(0, 10)))
      if (maxCost.value < 200)
        r = r.filter(e => e.cost <= maxCost.value)
      if (openOnly.value)
        r = r.filter(e => e.tix > 0)
      if (showPicked.value)
        r = r.filter(e => myPicks.value.has(e.id))
      if (selectedAges.value.size)
        r = r.filter(e => selectedAges.value.has(e.age))
      if (selectedExps.value.size)
        r = r.filter(e => selectedExps.value.has(e.exp))
      if (maxDuration.value < 10)
        r = r.filter(e => e.dur <= maxDuration.value)
      if (selectedVenues.value.size)
        r = r.filter(e => selectedVenues.value.has(normLoc(e.loc)))
      if (noMaterials.value)
        r = r.filter(e => !e.mat)
      if (noTournaments.value)
        r = r.filter(e => !e.tour)
      return r
    }

    const filteredExcludingType = computed(() => applyBaseFilters(events.value))

    const filteredEvents = computed(() => {
      let r = filteredExcludingType.value
      if (selectedTypes.value.size)
        r = r.filter(e => selectedTypes.value.has(e.type.substring(0, 3)))
      return r
    })

    // ── Type chip counts ──────────────────────────────────
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

    // ── Static option lists (built once after load) ───────
    const allAges   = computed(() => Object.keys(AGE_LABELS).filter(a => events.value.some(e => e.age === a)))
    const allExps   = computed(() => Object.keys(EXP_LABELS).filter(x => events.value.some(e => e.exp === x)))
    const allVenues = computed(() => {
      const seen = new Set()
      events.value.forEach(e => { const v = normLoc(e.loc); if (v) seen.add(v) })
      return [...seen].sort()
    })

    // ── Pagination ────────────────────────────────────────
    const page    = ref(1)
    const PAGE_SZ = 50
    watch(filteredEvents, () => { page.value = 1 })
    const displayedEvents = computed(() => filteredEvents.value.slice(0, page.value * PAGE_SZ))
    const hasMore         = computed(() => displayedEvents.value.length < filteredEvents.value.length)

    // ── My Picks ──────────────────────────────────────────
    const myPicks = ref(new Set(JSON.parse(localStorage.getItem('myPicks') || '[]')))
    const savePicks = () => localStorage.setItem('myPicks', JSON.stringify([...myPicks.value]))

    const customEvents   = ref(JSON.parse(localStorage.getItem('customEvents') || '[]'))
    const saveCustomEvents = () => localStorage.setItem('customEvents', JSON.stringify(customEvents.value))

    // ── Wishlist ──────────────────────────────────────────
    const wishlist = ref(new Set(JSON.parse(localStorage.getItem('wishlist') || '[]')))
    const saveWishlist = () => localStorage.setItem('wishlist', JSON.stringify([...wishlist.value]))

    const toggleWishlist = id => {
      const s = new Set(wishlist.value)
      s.has(id) ? s.delete(id) : s.add(id)
      wishlist.value = s
      saveWishlist()
    }

    const wishlistEvents = computed(() =>
      events.value.filter(e => wishlist.value.has(e.id))
        .sort((a, b) => a.start.localeCompare(b.start))
    )

    const REG_OPEN_MS = new Date('2026-05-17T16:00:00Z').getTime()
    const now = ref(Date.now())
    setInterval(() => { now.value = Date.now() }, 1000)

    const dataUpdated = ref(null)

    const dataAge = computed(() => {
      if (!dataUpdated.value) return null
      const ms = now.value - new Date(dataUpdated.value).getTime()
      const h = Math.floor(ms / 3600000)
      if (h < 1) return 'just now'
      if (h === 1) return '1 hour ago'
      if (h < 24) return `${h} hours ago`
      const d = Math.floor(h / 24)
      return d === 1 ? '1 day ago' : `${d} days ago`
    })

    const registrationOpen = computed(() => now.value >= REG_OPEN_MS)

    const countdown = computed(() => {
      const ms = Math.max(0, REG_OPEN_MS - now.value)
      const s  = Math.floor(ms / 1000)
      return {
        d: String(Math.floor(s / 86400)).padStart(2, '0'),
        h: String(Math.floor((s % 86400) / 3600)).padStart(2, '0'),
        m: String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
        s: String(s % 60).padStart(2, '0'),
      }
    })

    const openAllWishlistTabs = () => {
      const ids = [...wishlist.value]
      if (!ids.length) return
      if (!confirm(`Open ${ids.length} event${ids.length === 1 ? '' : 's'} on GenCon.com?\nThis will open ${ids.length} new tab${ids.length === 1 ? '' : 's'}.`)) return
      ids.forEach(id => {
        const numId = id.match(/\d+$/)?.[0]
        if (numId) window.open(`https://www.gencon.com/events/${numId}`, '_blank', 'noopener')
      })
    }

    const showCustomForm  = ref(false)
    const editingCustomId = ref(null)
    const customForm      = ref({ title: '', desc: '', date: '2026-07-30', startTime: '10:00', endTime: '11:00', loc: '' })
    const customFormError = ref({})

    const openCustomForm = (event = null) => {
      if (event) {
        editingCustomId.value = event.id
        customForm.value = {
          title:     event.title,
          desc:      event.desc  || '',
          date:      event.start.substring(0, 10),
          startTime: event.start.substring(11, 16),
          endTime:   event.end.substring(11, 16),
          loc:       event.loc   || '',
        }
      } else {
        editingCustomId.value = null
        customForm.value = { title: '', desc: '', date: '2026-07-30', startTime: '10:00', endTime: '11:00', loc: '' }
      }
      customFormError.value = {}
      showCustomForm.value  = true
    }

    const saveCustomEvent = async () => {
      const errs = {}
      const f = customForm.value
      if (!f.title.trim())           errs.title     = 'Title is required'
      else if (f.title.length > 200) errs.title     = 'Title must be under 200 characters'
      if (!f.date)                   errs.date      = 'Date is required'
      if (!f.startTime)              errs.startTime = 'Start time is required'
      if (!f.endTime)                errs.endTime   = 'End time is required'
      else if (f.endTime <= f.startTime) errs.endTime = 'End time must be after start time'
      customFormError.value = errs
      if (Object.keys(errs).length) return

      const start = `${f.date}T${f.startTime}`
      const end   = `${f.date}T${f.endTime}`
      const [sh, sm] = f.startTime.split(':').map(Number)
      const [eh, em] = f.endTime.split(':').map(Number)
      const dur = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10

      if (editingCustomId.value) {
        customEvents.value = customEvents.value.map(e =>
          e.id === editingCustomId.value
            ? { ...e, title: f.title.trim(), desc: f.desc.trim(), start, end, dur, loc: f.loc.trim() }
            : e
        )
        if (groupId.value && userName.value) {
          await sb.from('custom_events')
            .update({ title: f.title.trim(), description: f.desc.trim(), start_time: start, end_time: end, location: f.loc.trim() })
            .eq('id', editingCustomId.value).eq('group_id', groupId.value)
          await loadGroupCustomEvents()
        }
      } else {
        const newId = `custom-${Date.now()}`
        customEvents.value = [...customEvents.value, {
          id: newId, title: f.title.trim(), desc: f.desc.trim(),
          start, end, dur, loc: f.loc.trim(), room: '',
          cost: 0, type: 'ZED', tix: 1, minP: 1, maxP: 1,
          gm: '', grp: '', sys: '', age: '', exp: '', mat: false, tour: false, tbl: '', custom: true,
        }]
        if (groupId.value && userName.value) {
          await sb.from('custom_events').insert({
            id: newId, group_id: groupId.value, user_name: userName.value,
            title: f.title.trim(), description: f.desc.trim(),
            start_time: start, end_time: end, location: f.loc.trim(),
          })
          const pickRow = { group_id: groupId.value, user_name: userName.value, event_id: newId }
          if (authUserId.value) pickRow.user_auth_id = authUserId.value
          await sb.from('picks').insert(pickRow)
          await Promise.all([loadGroupPicks(), loadGroupCustomEvents()])
        }
      }
      saveCustomEvents()
      showCustomForm.value = false
    }

    const deleteCustomEvent = async id => {
      customEvents.value = customEvents.value.filter(e => e.id !== id)
      saveCustomEvents()
      if (selectedEvent.value?.id === id) selectedEvent.value = null
      if (groupId.value && userName.value) {
        await sb.from('custom_events').delete().eq('id', id).eq('group_id', groupId.value)
        await sb.from('picks').delete()
          .eq('group_id', groupId.value).eq('user_name', userName.value).eq('event_id', id)
        await Promise.all([loadGroupPicks(), loadGroupCustomEvents()])
      }
    }

    const togglePick = async id => {
      const s = new Set(myPicks.value)
      const adding = !s.has(id)
      adding ? s.add(id) : s.delete(id)
      myPicks.value = s
      savePicks()
      if (groupId.value && userName.value) {
        if (adding) {
          const row = { group_id: groupId.value, user_name: userName.value, event_id: id }
          if (authUserId.value) row.user_auth_id = authUserId.value
          await sb.from('picks').insert(row)
        } else {
          await sb.from('picks').delete()
            .eq('group_id', groupId.value).eq('user_name', userName.value).eq('event_id', id)
        }
      }
    }

    // ── Schedule ──────────────────────────────────────────
    const mySchedule = computed(() =>
      [...events.value.filter(e => myPicks.value.has(e.id)), ...customEvents.value]
        .sort((a, b) => a.start.localeCompare(b.start))
    )

    const conflicts = computed(() => {
      const sched = mySchedule.value
      const ids = new Set()
      const t = dt => dt.substring(0, 16)
      for (let i = 0; i < sched.length; i++)
        for (let j = i + 1; j < sched.length; j++)
          if (t(sched[i].start) < t(sched[j].end) && t(sched[i].end) > t(sched[j].start)) {
            ids.add(sched[i].id); ids.add(sched[j].id)
          }
      return ids
    })

    const totalCost = computed(() => {
      const sum = mySchedule.value.reduce((t, e) => t + e.cost, 0)
      return Number.isInteger(sum) ? sum : sum.toFixed(2)
    })

    const DAY_SHORT_LABEL = { '2026-07-30': 'Thu', '2026-07-31': 'Fri', '2026-08-01': 'Sat', '2026-08-02': 'Sun' }

    const scheduleDays = computed(() => {
      const byDay = {}
      mySchedule.value.forEach(e => {
        const d = e.start.substring(0, 10)
        ;(byDay[d] = byDay[d] || []).push(e)
      })
      return Object.entries(byDay).map(([date, evts]) => ({
        date,
        label: DAY_LABELS[date] || date,
        shortLabel: DAY_SHORT_LABEL[date] || date,
        events: evts,
      }))
    })

    // ── Timeline ──────────────────────────────────────────
    const PX_PER_HOUR = 80
    const scheduleDay = ref(null)

    watch(scheduleDays, days => {
      if (!days.length) { scheduleDay.value = null; return }
      if (!days.find(d => d.date === scheduleDay.value))
        scheduleDay.value = days[0].date
    }, { immediate: true })

    const timelineEvents = computed(() =>
      scheduleDay.value
        ? mySchedule.value.filter(e => e.start.startsWith(scheduleDay.value))
        : []
    )

    const timelineBounds = computed(() => {
      const evts = timelineEvents.value
      if (!evts.length) return { start: 9, end: 18 }
      const startHours = evts.map(e => parseInt(e.start.substring(11, 13)))
      const endHours   = evts.map(e => {
        const h = parseInt(e.end.substring(11, 13))
        const m = parseInt(e.end.substring(14, 16))
        return h + (m > 0 ? 1 : 0)
      })
      return {
        start: Math.max(0,  Math.min(...startHours) - 1),
        end:   Math.min(24, Math.max(...endHours)   + 1),
      }
    })

    const timelineHours  = computed(() => {
      const { start, end } = timelineBounds.value
      return Array.from({ length: end - start }, (_, i) => start + i)
    })

    const timelineHeight = computed(() =>
      (timelineBounds.value.end - timelineBounds.value.start) * PX_PER_HOUR
    )

    const eventTimelineStyle = e => {
      const { start } = timelineBounds.value
      const sh = parseInt(e.start.substring(11, 13)) + parseInt(e.start.substring(14, 16)) / 60
      let   eh = parseInt(e.end.substring(11, 13))   + parseInt(e.end.substring(14, 16))   / 60
      if (eh <= sh) eh += 24  // handle midnight crossover
      return {
        top:        (sh - start) * PX_PER_HOUR + 'px',
        height:     Math.max((eh - sh) * PX_PER_HOUR - 4, 28) + 'px',
        background: typeColor(e.type),
      }
    }

    const formatHour = h => {
      const hh = h % 24
      if (hh === 0)  return '12am'
      if (hh === 12) return '12pm'
      return hh < 12 ? `${hh}am` : `${hh - 12}pm`
    }

    // ── Group ─────────────────────────────────────────────
    const userName           = ref(localStorage.getItem('userName')  || '')
    const groupName          = ref(localStorage.getItem('groupName') || '')
    const groupId            = ref(localStorage.getItem('groupId')   || '')
    const groupPicks         = ref({})
    const groupCustomEvents  = ref([])
    const inputUserName  = ref('')
    const inputGroupName = ref('')
    const groupLoading   = ref(false)
    const groupError     = ref('')
    let   realtimeCh     = null
    const chatMessages   = ref([])
    const chatInput      = ref('')
    const chatSending    = ref(false)
    const chatLogEl      = ref(null)

    const joinOrCreateGroup = async () => {
      const uname = inputUserName.value.trim()
      const gname = inputGroupName.value.trim()
      if (!uname || !gname) return
      groupLoading.value = true
      groupError.value   = ''
      try {
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
        localStorage.setItem('userName', uname)
        localStorage.setItem('groupName', gname)
        localStorage.setItem('groupId', gid)
        const existing_picks = [...myPicks.value].map(event_id => {
          const row = { group_id: gid, user_name: uname, event_id }
          if (authUserId.value) row.user_auth_id = authUserId.value
          return row
        })
        if (existing_picks.length)
          await sb.from('picks').upsert(existing_picks, { onConflict: 'group_id,user_name,event_id' })
        if (customEvents.value.length) {
          await sb.from('custom_events').upsert(
            customEvents.value.map(e => ({
              id: e.id, group_id: gid, user_name: uname,
              title: e.title, description: e.desc || '',
              start_time: e.start, end_time: e.end, location: e.loc || '',
            })),
            { onConflict: 'id,group_id' }
          )
          const customPickRows = customEvents.value.map(e => {
            const row = { group_id: gid, user_name: uname, event_id: e.id }
            if (authUserId.value) row.user_auth_id = authUserId.value
            return row
          })
          await sb.from('picks').upsert(customPickRows, { onConflict: 'group_id,user_name,event_id' })
        }
        await loadGroupPicks()
        await loadGroupCustomEvents()
        await loadMessages()
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
      groupId.value = ''; groupName.value = ''; userName.value = ''
      groupPicks.value = {}; groupCustomEvents.value = []; chatMessages.value = []
      localStorage.removeItem('groupId'); localStorage.removeItem('groupName'); localStorage.removeItem('userName')
    }

    const loadGroupPicks = async () => {
      if (!groupId.value) return
      const { data } = await sb.from('picks').select('user_name,event_id').eq('group_id', groupId.value)
      if (!data) return
      const picks = {}
      data.forEach(({ user_name, event_id }) => { (picks[user_name] = picks[user_name] || []).push(event_id) })
      groupPicks.value = picks
    }

    const loadGroupCustomEvents = async () => {
      if (!groupId.value) return
      const { data } = await sb.from('custom_events').select('*').eq('group_id', groupId.value)
      if (!data) return
      groupCustomEvents.value = data.map(r => {
        const [sh, sm] = r.start_time.substring(11, 16).split(':').map(Number)
        const [eh, em] = r.end_time.substring(11, 16).split(':').map(Number)
        return {
          id: r.id, title: r.title, desc: r.description,
          start: r.start_time, end: r.end_time,
          dur: Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10,
          loc: r.location, room: '', cost: 0, type: 'ZED', tix: 1, minP: 1, maxP: 1,
          gm: '', grp: '', sys: '', age: '', exp: '', mat: false, tour: false, tbl: '', custom: true,
        }
      })
    }

    const scrollChatToBottom = () => nextTick(() => {
      if (chatLogEl.value) chatLogEl.value.scrollTop = chatLogEl.value.scrollHeight
    })

    const loadMessages = async () => {
      if (!groupId.value) return
      const { data } = await sb.from('messages')
        .select('id,user_name,body,created_at')
        .eq('group_id', groupId.value)
        .order('created_at', { ascending: true })
        .limit(200)
      if (data) { chatMessages.value = data; scrollChatToBottom() }
    }

    const sendMessage = async () => {
      // Strip C0/C1 control characters; allow all visible Unicode text
      const clean = chatInput.value.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim().slice(0, 500)
      if (!clean || !groupId.value || !userName.value || chatSending.value) return
      chatInput.value = ''
      chatSending.value = true
      try {
        const { data } = await sb.from('messages')
          .insert({ group_id: groupId.value, user_name: userName.value, body: clean })
          .select('id,user_name,body,created_at').single()
        if (data) { chatMessages.value.push(data); scrollChatToBottom() }
        if (realtimeCh) realtimeCh.send({ type: 'broadcast', event: 'chat', payload: {} })
      } finally {
        chatSending.value = false
      }
    }

    // Refresh picks every time the user opens the group tab
    watch(view, v => { if (v === 'group' && groupId.value) { loadGroupPicks(); loadGroupCustomEvents(); loadMessages() } })

    const subscribeToGroup = () => {
      if (realtimeCh) sb.removeChannel(realtimeCh)
      realtimeCh = sb.channel(`group-${groupId.value}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'picks', filter: `group_id=eq.${groupId.value}` }, () => loadGroupPicks())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_events', filter: `group_id=eq.${groupId.value}` }, () => loadGroupCustomEvents())
        .on('broadcast', { event: 'chat' }, () => loadMessages())
        .subscribe()
    }

    const sharedOpen     = ref(true)
    const schedDaysOpen  = ref({})
    const toggleShared   = () => { sharedOpen.value = !sharedOpen.value }
    const toggleSchedDay = date => { schedDaysOpen.value = { ...schedDaysOpen.value, [date]: !(schedDaysOpen.value[date] ?? true) } }
    const schedDayOpen   = date => schedDaysOpen.value[date] ?? true

    const isGroupPick    = id => Object.entries(groupPicks.value).some(([u, picks]) => u !== userName.value && picks.includes(id))
    const groupWantsCount = id => Object.entries(groupPicks.value).filter(([u, picks]) => u !== userName.value && picks.includes(id)).length || null
    const sharedBy       = id => Object.entries(groupPicks.value).filter(([, picks]) => picks.includes(id)).map(([u]) => u)

    const groupEventPool = computed(() => [...events.value, ...groupCustomEvents.value])

    const sharedEvents = computed(() => {
      const allIds = Object.values(groupPicks.value).flat()
      const counts = {}
      allIds.forEach(id => { counts[id] = (counts[id] || 0) + 1 })
      const multi = new Set(Object.entries(counts).filter(([, c]) => c >= 2).map(([id]) => id))
      return groupEventPool.value.filter(e => multi.has(e.id)).sort((a, b) => a.start.localeCompare(b.start))
    })

    const memberCost = member =>
      (groupPicks.value[member] || []).reduce((sum, id) => {
        const e = events.value.find(ev => ev.id === id)
        return sum + (e ? e.cost : 0)
      }, 0)

    const MEMBER_PALETTE = [
      '#4f46e5', '#dc2626', '#059669', '#d97706',
      '#7c3aed', '#0891b2', '#be185d', '#16a34a',
    ]
    const memberColors = computed(() => {
      const colors = {}
      Object.keys(groupPicks.value).forEach((name, i) => {
        colors[name] = MEMBER_PALETTE[i % MEMBER_PALETTE.length]
      })
      return colors
    })

    const nameColor = name => {
      let h = 0
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
      return MEMBER_PALETTE[h % MEMBER_PALETTE.length]
    }

    const whoWants = id =>
      Object.entries(groupPicks.value)
        .filter(([, picks]) => picks.includes(id))
        .map(([name]) => name)

    const groupSchedule = computed(() => {
      const allEventIds = new Set(Object.values(groupPicks.value).flat())
      const allEvents = groupEventPool.value.filter(e => allEventIds.has(e.id))
        .sort((a, b) => a.start.localeCompare(b.start))
      const byDay = {}
      allEvents.forEach(e => {
        const d = e.start.substring(0, 10)
        ;(byDay[d] = byDay[d] || []).push(e)
      })
      return Object.entries(byDay).map(([date, evts]) => ({
        date,
        label: DAY_LABELS[date] || date,
        events: evts,
      }))
    })

    // ── Modal ─────────────────────────────────────────────
    const selectedEvent = ref(null)
    onMounted(() => window.addEventListener('keydown', e => {
      if (e.key === 'Escape') { selectedEvent.value = null; showCustomForm.value = false }
    }))

    // ── Formatting ────────────────────────────────────────
    const typeCode  = type => TYPE_LABELS[type.substring(0, 3)] || type.substring(0, 3)
    const typeColor = type => TYPE_COLORS[type.substring(0, 3)] || '#6b7280'

    const formatTime = dt => {
      if (!dt) return ''
      const [, timePart] = dt.split('T')
      const [hh, mm] = timePart.split(':')
      const h = parseInt(hh), ampm = h < 12 ? 'am' : 'pm', h12 = h % 12 || 12
      return mm === '00' ? `${h12}${ampm}` : `${h12}:${mm}${ampm}`
    }

    const formatDayShort = dt => dt ? (DAY_SHORT[dt.substring(0, 10)] || '') : ''
    const formatDayLong  = dt => dt ? (DAY_LABELS[dt.substring(0, 10)] || dt.substring(0, 10)) : ''

    // ── Deep Links ────────────────────────────────────────
    const sharedPickIds   = ref([])
    const shareLinkCopied = ref(false)
    const groupLinkCopied = ref(false)

    const setView = v => {
      view.value = v
      if (v !== 'shared') history.pushState(null, '', '#' + v)
    }

    const parseHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1))
      if (hash.startsWith('shared/')) {
        sharedPickIds.value = hash.slice(7).split(',').filter(Boolean)
        view.value = 'shared'
      } else if (hash.startsWith('group/')) {
        inputGroupName.value = hash.slice(6)
        view.value = 'group'
      } else if (['browse', 'schedule', 'group'].includes(hash)) {
        view.value = hash
      }
    }

    const copyShareLink = async () => {
      const ids = [...myPicks.value].join(',')
      const url = `${location.origin}${location.pathname}#shared/${ids}`
      try {
        await navigator.clipboard.writeText(url)
        shareLinkCopied.value = true
        setTimeout(() => { shareLinkCopied.value = false }, 2000)
      } catch {
        prompt('Copy this link to share your itinerary:', url)
      }
    }

    const copyGroupLink = async () => {
      const url = `${location.origin}${location.pathname}#group/${encodeURIComponent(groupName.value)}`
      try {
        await navigator.clipboard.writeText(url)
        groupLinkCopied.value = true
        setTimeout(() => { groupLinkCopied.value = false }, 2000)
      } catch {
        prompt('Copy this invite link:', url)
      }
    }

    const copySharedToMyPicks = async () => {
      const newIds = sharedPickIds.value.filter(id => !myPicks.value.has(id))
      const s = new Set(myPicks.value)
      sharedPickIds.value.forEach(id => s.add(id))
      myPicks.value = s
      savePicks()
      if (groupId.value && userName.value && newIds.length) {
        const rows = newIds.map(event_id => {
          const row = { group_id: groupId.value, user_name: userName.value, event_id }
          if (authUserId.value) row.user_auth_id = authUserId.value
          return row
        })
        await sb.from('picks').upsert(rows, { onConflict: 'group_id,user_name,event_id' })
      }
      setView('schedule')
    }

    const sharedSchedule = computed(() =>
      events.value.filter(e => sharedPickIds.value.includes(e.id))
        .sort((a, b) => a.start.localeCompare(b.start))
    )

    const sharedScheduleDays = computed(() => {
      const byDay = {}
      sharedSchedule.value.forEach(e => {
        const d = e.start.substring(0, 10)
        ;(byDay[d] = byDay[d] || []).push(e)
      })
      return Object.entries(byDay).map(([date, evts]) => ({
        date, label: DAY_LABELS[date] || date, events: evts,
      }))
    })

    const sharedTotalCost = computed(() => {
      const sum = sharedSchedule.value.reduce((t, e) => t + e.cost, 0)
      return Number.isInteger(sum) ? sum : sum.toFixed(2)
    })

    // ── ICS Export ────────────────────────────────────────
    const exportICS = () => {
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0',
        'PRODID:-//GenCon 2026 Schedule Helper//EN',
        'CALSCALE:GREGORIAN', 'X-WR-CALNAME:GenCon 2026',
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
      Object.assign(document.createElement('a'), { href: url, download: 'gencon2026.ics' }).click()
      URL.revokeObjectURL(url)
    }

    // ── Init ──────────────────────────────────────────────
    onMounted(async () => {
      // Try to establish an anonymous session; non-fatal if the provider is disabled
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (session?.user) {
          authUserId.value = session.user.id
        } else {
          const { data } = await sb.auth.signInAnonymously()
          authUserId.value = data.user?.id ?? null
        }
      } catch (_) { /* anonymous auth disabled — picks work without it */ }

      events.value  = await (await fetch('./events.json')).json()
      loading.value = false
      try {
        const meta = await (await fetch(`./meta.json?_=${Date.now()}`)).json()
        dataUpdated.value = meta.updated
      } catch (_) {}
      if (groupId.value) { await loadGroupPicks(); await loadGroupCustomEvents(); await loadMessages(); subscribeToGroup() }
      window.addEventListener('popstate', parseHash)
      parseHash()
    })

    return {
      loading, events, view, filtersOpen, authUserId,
      sharedPickIds, shareLinkCopied, groupLinkCopied,
      setView, copyShareLink, copyGroupLink, copySharedToMyPicks,
      sharedSchedule, sharedScheduleDays, sharedTotalCost,
      search, filterDay, selectedTypes, maxCost, openOnly, showPicked,
      moreFiltersOpen, selectedAges, selectedExps, maxDuration, selectedVenues, noMaterials, noTournaments,
      days, eventTypes, allAges, allExps, allVenues,
      filteredEvents, displayedEvents, hasMore, activeFilterCount, moreFilterCount,
      myPicks, togglePick, mySchedule, conflicts, totalCost, scheduleDays,
      customEvents, groupCustomEvents, showCustomForm, editingCustomId, customForm, customFormError,
      openCustomForm, saveCustomEvent, deleteCustomEvent,
      wishlist, toggleWishlist, wishlistEvents, registrationOpen, countdown, openAllWishlistTabs,
      dataAge,
      scheduleDay, timelineEvents, timelineBounds, timelineHours, timelineHeight,
      eventTimelineStyle, formatHour, PX_PER_HOUR,
      userName, groupName, groupId, groupPicks,
      inputUserName, inputGroupName, groupLoading, groupError, sharedEvents,
      memberColors, whoWants, groupSchedule, nameColor,
      sharedOpen, toggleShared, schedDayOpen, toggleSchedDay,
      chatMessages, chatInput, chatSending, chatLogEl, sendMessage,
      selectedEvent,
      toggleDay, toggleType, toggleAge, toggleExp, toggleVenue, clearFilters,
      joinOrCreateGroup, leaveGroup, isGroupPick, groupWantsCount, sharedBy, memberCost,
      typeCode, typeColor, formatTime, formatDayShort, formatDayLong, exportICS,
      AGE_LABELS, EXP_LABELS,
      page,
    }
  },
}).mount('#app')
