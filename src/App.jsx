import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Loader2, AlertCircle, ChevronRight, RefreshCw,
  Brain, Sparkles, Shield, Settings, Check, TrendingUp, TrendingDown,
} from 'lucide-react';
import { evaluateRulesEngine } from './rulesEngine';

const HERO_ROLES = {
  'd-va': 'tank', 'doomfist': 'tank', 'domina': 'tank', 'hazard': 'tank',
  'junker-queen': 'tank', 'mauga': 'tank', 'orisa': 'tank', 'ramattra': 'tank',
  'reinhardt': 'tank', 'roadhog': 'tank', 'sigma': 'tank', 'winston': 'tank',
  'wrecking-ball': 'tank', 'zarya': 'tank',
  'anran': 'damage', 'ashe': 'damage', 'bastion': 'damage', 'cassidy': 'damage',
  'echo': 'damage', 'emre': 'damage', 'freja': 'damage', 'genji': 'damage',
  'hanzo': 'damage', 'junkrat': 'damage', 'mei': 'damage', 'pharah': 'damage',
  'reaper': 'damage', 'sierra': 'damage', 'sojourn': 'damage', 'soldier-76': 'damage',
  'sombra': 'damage', 'symmetra': 'damage', 'torbjorn': 'damage', 'tracer': 'damage',
  'vendetta': 'damage', 'venture': 'damage', 'widowmaker': 'damage',
  'ana': 'support', 'baptiste': 'support', 'brigitte': 'support', 'illari': 'support',
  'juno': 'support', 'kiriko': 'support', 'lifeweaver': 'support', 'lucio': 'support',
  'mercy': 'support', 'moira': 'support', 'wuyang': 'support', 'zenyatta': 'support',
};

const HERO_DISPLAY = {
  'd-va': 'D.Va', doomfist: 'Doomfist', domina: 'Domina', hazard: 'Hazard',
  'junker-queen': 'Junker Queen', mauga: 'Mauga', orisa: 'Orisa', ramattra: 'Ramattra',
  reinhardt: 'Reinhardt', roadhog: 'Roadhog', sigma: 'Sigma', winston: 'Winston',
  'wrecking-ball': 'Wrecking Ball', zarya: 'Zarya',
  anran: 'Anran', ashe: 'Ashe', bastion: 'Bastion', cassidy: 'Cassidy',
  echo: 'Echo', emre: 'Emre', freja: 'Freja', genji: 'Genji',
  hanzo: 'Hanzo', junkrat: 'Junkrat', mei: 'Mei', pharah: 'Pharah',
  reaper: 'Reaper', sierra: 'Sierra', sojourn: 'Sojourn', 'soldier-76': 'Soldier: 76',
  sombra: 'Sombra', symmetra: 'Symmetra', torbjorn: 'Torbjörn', tracer: 'Tracer',
  vendetta: 'Vendetta', venture: 'Venture', widowmaker: 'Widowmaker',
  ana: 'Ana', baptiste: 'Baptiste', brigitte: 'Brigitte', illari: 'Illari',
  juno: 'Juno', kiriko: 'Kiriko', lifeweaver: 'Lifeweaver', lucio: 'Lúcio',
  mercy: 'Mercy', moira: 'Moira', wuyang: 'Wuyang', zenyatta: 'Zenyatta',
};

const TIER_COLORS = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700', platinum: '#40e0d0',
  diamond: '#4fc3f7', master: '#ce93d8', grandmaster: '#ef5350',
  ultimate: '#ff8a65', champion: '#fff176',
};

const QUEUES = [
  { key: 'tank',    label: 'Tank',       apiKey: 'tank' },
  { key: 'damage',  label: 'DPS',        apiKey: 'damage' },
  { key: 'support', label: 'Support',    apiKey: 'support' },
  { key: 'open',    label: 'Open Queue', apiKey: 'open' },
];

const ROLE_PROMPTS = {
  tank:    `You are coaching a Tank player. Focus on space-taking, positioning relative to support LOS, when to take vs avoid fights, target selection, reading enemy support cooldowns (suzu, immortality, sleep), ult tracking.`,
  damage:  `You are coaching a DPS player. Focus on target priority, off-angle discipline, trading efficiency, mechanical consistency (crit accuracy on hitscan, leading on projectile heroes), and hero counter-swaps.`,
  support: `You are coaching a Support player. Focus on cooldown sequencing (anti-nade timing, suzu cleanse priority, immortality placement), positioning relative to tank frontline, off-angles for damage, ult economy, and reading flanker pressure.`,
  open:    `You are coaching an Open Queue player. Focus on role flexibility, recognising what the team is missing in hero select, and adapting playstyle for unusual comps.`,
};

const DEFAULT_PROXY = 'https://muddy-bird-c449.homehfoster.workers.dev';

const normaliseCareerData = (data) => {
  if (!data || typeof data !== 'object') return null;
  // OverFast may return { hero: {...} } or wrap inside another key
  if (data['all-heroes'] || Object.keys(data).some(k => HERO_ROLES[k])) return data;
  // Try one level of unwrapping
  const vals = Object.values(data);
  if (vals.length === 1 && typeof vals[0] === 'object') return vals[0];
  return data;
};

const statsForRole = (h, role) => {
  const common = [
    { label: 'WR',    val: fmtPct(h.winrate) },
    { label: 'Games', val: String(h.gamesPlayed ?? '—') },
  ];
  if (role === 'tank')    return [...common,
    { label: 'Elims/10',  val: fmt(h.elimsPer10) },
    { label: 'Deaths/10', val: fmt(h.deathsPer10),  tone: 'rose' },
    { label: 'Damage/10', val: fmt(h.damagePer10) },
    { label: 'FB/10',     val: fmt(h.finalBlowsPer10) },
  ];
  if (role === 'damage')  return [...common,
    { label: 'Elims/10',  val: fmt(h.elimsPer10) },
    { label: 'Deaths/10', val: fmt(h.deathsPer10),  tone: 'rose' },
    { label: 'Damage/10', val: fmt(h.damagePer10) },
    { label: 'Crit %',    val: fmtPct(h.critAcc) },
  ];
  if (role === 'support') return [...common,
    { label: 'Heal/10',   val: fmt(h.healingPer10), tone: 'emerald' },
    { label: 'Deaths/10', val: fmt(h.deathsPer10),  tone: 'rose' },
    { label: 'Elims/10',  val: fmt(h.elimsPer10) },
    { label: 'FB/10',     val: fmt(h.finalBlowsPer10) },
  ];
  return [...common,
    { label: 'Deaths/10', val: fmt(h.deathsPer10),  tone: 'rose' },
    { label: 'Elims/10',  val: fmt(h.elimsPer10) },
    { label: 'FB/10',     val: fmt(h.finalBlowsPer10) },
    { label: 'Heal/10',   val: fmt(h.healingPer10), tone: 'emerald' },
  ];
};

const fmt    = (n) => n != null ? Number(n.toFixed(1)).toString() : '—';
const fmtPct = (n) => n != null ? Math.round(n * 100) + '%' : '—';
const fmtTime = (s) => {
  if (s == null) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const TONE = { rose: 'text-rose-400', emerald: 'text-emerald-400', default: 'text-sky-100' };

const buildHeroStats = (data) => {
  if (!data) return [];
  return Object.entries(data)
    .filter(([k]) => k !== 'all-heroes')
    .flatMap(([key, d]) => {
      if (!d?.game?.time_played) return [];
      return [{
        hero: key,
        role:            HERO_ROLES[key] || 'unknown',
        timePlayed:      d.game.time_played,
        gamesPlayed:     d.game.games_played ?? 0,
        gamesWon:        d.game.games_won ?? 0,
        winrate:         d.game.games_played ? d.game.games_won / d.game.games_played : null,
        healingPer10:    d.average?.healing_done_avg_per_10_min ?? null,
        deathsPer10:     d.average?.deaths_avg_per_10_min ?? null,
        elimsPer10:      d.average?.eliminations_avg_per_10_min ?? null,
        finalBlowsPer10: d.average?.final_blows_avg_per_10_min ?? null,
        damagePer10:     d.average?.hero_damage_done_avg_per_10_min ?? null,
        critAcc:         d.combat?.critical_hit_accuracy ?? d.combat?.scoped_accuracy ?? null,
      }];
    })
    .sort((a, b) => b.timePlayed - a.timePlayed);
};

export default function OverwatchCoach() {
  const [battleTag, setBattleTag]         = useState('');
  const [platform, setPlatform]           = useState('pc');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [profile, setProfile]             = useState(null);
  const [career, setCareer]               = useState(null);
  const [allSeasonHeroes, setAllSeasonHeroes] = useState([]); // [{hero, pickrate, winrate}] all-time
  const [careerOpen, setCareerOpen]       = useState(null);
  const [openQueueError, setOpenQueueError] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState('support');
  const [coaching, setCoaching]           = useState(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError, setCoachingError]     = useState(null);
  const [showSettings, setShowSettings]   = useState(false);
  const [proxyUrl, setProxyUrl]           = useState('');
  const [proxyDraft, setProxyDraft]       = useState('');
  const [proxySaved, setProxySaved]       = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage?.get('overfast_proxy_url');
        if (r?.value) { setProxyUrl(r.value); setProxyDraft(r.value); }
      } catch {}
    })();
  }, []);

  const saveProxy = async () => {
    const trimmed = proxyDraft.trim().replace(/\/+$/, '');
    setProxyUrl(trimmed);
    try {
      if (trimmed) await window.storage?.set('overfast_proxy_url', trimmed);
      else         await window.storage?.delete('overfast_proxy_url');
      setProxySaved(true);
      setTimeout(() => setProxySaved(false), 1500);
    } catch {}
  };

  const apiBase = proxyUrl || DEFAULT_PROXY;

  const allHeroStats = useMemo(() => buildHeroStats(career),  [career]);
  const openHeroStats = useMemo(() => buildHeroStats(careerOpen), [careerOpen]);

  const visibleHeroStats = useMemo(() => (
    selectedQueue === 'open' ? openHeroStats : allHeroStats.filter(h => h.role === selectedQueue)
  ), [allHeroStats, openHeroStats, selectedQueue]);

  // Top 3 / bottom 3 — prefer all-season /stats data; fall back to current career stats
  const heroHighlights = useMemo(() => {
    let source;
    if (allSeasonHeroes.length > 0) {
      // /stats endpoint returns winrate already as 0–100
      source = allSeasonHeroes;
    } else {
      // career fallback: normalise winrate 0–1 → 0–100, add pickrate placeholder
      source = allHeroStats
        .filter(h => h.winrate !== null)
        .map(h => ({ hero: h.hero, winrate: h.winrate * 100, pickrate: null }));
    }
    if (!source.length) return { top: [], bottom: [] };
    const sorted = [...source].sort((a, b) => b.winrate - a.winrate);
    const top = sorted.slice(0, 3);
    const topKeys = new Set(top.map(h => h.hero));
    const bottom = sorted.filter(h => !topKeys.has(h.hero)).slice(-3).reverse();
    return { top, bottom, allSeason: allSeasonHeroes.length > 0 };
  }, [allSeasonHeroes, allHeroStats]);

  useEffect(() => {
    if (!career || !allHeroStats.length) return;
    const byRole = {};
    for (const h of allHeroStats) {
      if (h.role === 'unknown') continue;
      byRole[h.role] = (byRole[h.role] || 0) + h.timePlayed;
    }
    const top = Object.entries(byRole).sort((a, b) => b[1] - a[1])[0];
    if (top) setSelectedQueue(top[0]);
  }, [career, allHeroStats]);

  const ranks = profile?.competitive?.[platform] || {};

  const loadStats = async () => {
    const tag = battleTag.trim();
    if (!tag) return;
    setLoading(true); setError(null); setProfile(null); setCareer(null); setAllSeasonHeroes([]);
    setCareerOpen(null); setOpenQueueError(null); setCoaching(null); setCoachingError(null);
    try {
      const playerId = tag.replace('#', '-');
      const sumRes = await fetch(`${apiBase}/players/${encodeURIComponent(playerId)}/summary`);
      if (!sumRes.ok) {
        if (sumRes.status === 404) throw new Error('Player not found. Check the BattleTag format (Name#1234).');
        let detail = '';
        try { detail = (await sumRes.text()).slice(0, 200); } catch {}
        throw new Error(`Profile lookup failed (${sumRes.status})${detail ? ' — ' + detail : ''}`);
      }
      const summary = await sumRes.json();
      if (summary.privacy === 'private') throw new Error('Career profile is private. Overwatch → Options → Social → Career Profile Visibility → Public.');

      const careerRes = await fetch(
        `${apiBase}/players/${encodeURIComponent(playerId)}/stats/career?gamemode=competitive&platform=${platform}`
      );
      if (!careerRes.ok) throw new Error(`Career stats failed (${careerRes.status})`);
      const rawCareer = await careerRes.json();

      // Fetch all-season hero winrates + open queue in parallel
      let openData = null;
      let openErr = null;
      let allSeasonData = [];
      const [openRes, allSeasonRes] = await Promise.all([
        fetch(`${apiBase}/players/${encodeURIComponent(playerId)}/stats/career?gamemode=competitive_open_queue&platform=${platform}`),
        fetch(`${apiBase}/players/${encodeURIComponent(playerId)}/stats?gamemode=competitive`),
      ]);

      try {
        if (openRes.ok) {
          openData = normaliseCareerData(await openRes.json());
        } else if (openRes.status !== 404) {
          openErr = `Open Queue stats unavailable (${openRes.status})`;
        }
      } catch { openErr = 'Open Queue stats could not be loaded'; }

      try {
        if (allSeasonRes.ok) {
          const raw = await allSeasonRes.json();
          // Endpoint returns [{hero, pickrate, winrate}] — filter to known heroes only
          if (Array.isArray(raw)) allSeasonData = raw.filter(h => h.hero && h.winrate != null);
        }
      } catch {}

      setProfile(summary);
      setCareer(normaliseCareerData(rawCareer));
      setAllSeasonHeroes(allSeasonData);
      setCareerOpen(openData);
      if (openErr) setOpenQueueError(openErr);
    } catch (e) {
      const msg = e.message || 'Unexpected error';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setError(`Network call to ${apiBase} was blocked. Run locally in VSCode for full functionality.`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const retryOpenQueue = async () => {
    if (!profile) return;
    setOpenQueueError(null);
    const playerId = battleTag.trim().replace('#', '-');
    try {
      const openRes = await fetch(
        `${apiBase}/players/${encodeURIComponent(playerId)}/stats/career?gamemode=competitive_open_queue&platform=${platform}`
      );
      if (openRes.ok) {
        const raw = await openRes.json();
        setCareerOpen(normaliseCareerData(raw));
      } else {
        setOpenQueueError(`Open Queue stats unavailable (${openRes.status})`);
      }
    } catch {
      setOpenQueueError('Open Queue stats could not be loaded');
    }
  };

  const askCoach = async () => {
    if (!visibleHeroStats.length) {
      setCoachingError(`No ${QUEUES.find(q => q.key === selectedQueue)?.label} stats found — try a different queue.`);
      return;
    }
    setCoachingLoading(true); setCoaching(null); setCoachingError(null);

    const top3 = visibleHeroStats.slice(0, 3);
    try {
      const analysis = evaluateRulesEngine(
        selectedQueue,
        top3,
        allHeroStats,
        ranks[QUEUES.find(q => q.key === selectedQueue).apiKey],
        profile?.competitive?.[platform]?.[selectedQueue]?.games_played || 0
      );
      setCoaching(analysis);
    } catch (e) {
      setCoachingError(e.message || 'Analysis failed');
    } finally {
      setCoachingLoading(false);
    }
  };

  const reset = () => {
    setProfile(null); setCareer(null); setAllSeasonHeroes([]); setCareerOpen(null);
    setCoaching(null); setError(null); setCoachingError(null); setOpenQueueError(null);
  };
  const queueLabel = QUEUES.find(q => q.key === selectedQueue)?.label || '';

  return (
    <div className="min-h-screen w-full" style={{
      background: 'radial-gradient(ellipse at 20% -5%, #0c2a4e 0%, #000d20 40%, #000408 100%)',
      fontFamily: '"Barlow", system-ui, sans-serif',
      color: '#c8e6f5',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Barlow:wght@300;400;500;600&family=Fira+Code:wght@400;500&display=swap');
        .display { font-family: 'Rajdhani', 'Impact', sans-serif; letter-spacing: 0.04em; }
        .mono { font-family: 'Fira Code', 'Menlo', monospace; }
        input, select, textarea { color-scheme: dark; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #000d20; }
        ::-webkit-scrollbar-thumb { background: #0ea5e9; border-radius: 3px; }
      `}</style>

      <div className="relative max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10 pb-8" style={{ borderBottom: '1px solid rgba(14,165,233,0.2)' }}>
          <div className="flex items-baseline gap-4 mb-3">
            <div className="display text-xs tracking-[0.35em] uppercase" style={{ color: '#38bdf8' }}>
              Field Manual {profile && `· ${queueLabel}`}
            </div>
            <div className="h-px flex-1" style={{ background: 'rgba(14,165,233,0.25)' }} />
            <div className="mono text-xs" style={{ color: '#2d5a7a' }}>v2 · all roles</div>
          </div>
          <h1 className="display font-bold leading-none" style={{ fontSize: 'clamp(2.8rem,7vw,4rem)', color: '#e0f2fe' }}>
            RANKED{' '}
            <span style={{ color: '#0ea5e9', textShadow: '0 0 30px rgba(14,165,233,0.4)' }}>COACH</span>
          </h1>
          <p className="mt-3 text-sm max-w-2xl leading-relaxed" style={{ color: '#4d7a9a' }}>
            Pulls your competitive stats across all four queues and delivers role-specific coaching tuned to your rank.
            Run locally in VSCode for full functionality.
          </p>
        </div>

        {/* Lookup */}
        {!profile && (
          <div className="space-y-6">
            <div>
              <label className="display text-xs uppercase tracking-[0.3em] block mb-2" style={{ color: 'rgba(56,189,248,0.8)' }}>BattleTag</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" value={battleTag} onChange={e => setBattleTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadStats()} placeholder="YourName#1234"
                  className="mono flex-1 px-4 py-3 transition-colors"
                  style={{
                    background: 'rgba(0,18,35,0.8)', border: '1px solid rgba(14,165,233,0.25)',
                    color: '#e0f2fe', outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(14,165,233,0.7)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(14,165,233,0.25)'}
                  disabled={loading} />
                <select value={platform} onChange={e => setPlatform(e.target.value)}
                  className="mono px-4 py-3 transition-colors"
                  style={{
                    background: 'rgba(0,18,35,0.8)', border: '1px solid rgba(14,165,233,0.25)',
                    color: '#e0f2fe', outline: 'none',
                  }}
                  disabled={loading}>
                  <option value="pc">PC</option>
                  <option value="console">Console</option>
                </select>
                <button onClick={loadStats} disabled={loading || !battleTag.trim()}
                  className="display tracking-wider uppercase font-semibold px-6 py-3 transition-all flex items-center justify-center gap-2"
                  style={{
                    background: loading || !battleTag.trim() ? 'rgba(14,165,233,0.1)' : '#0ea5e9',
                    color: loading || !battleTag.trim() ? '#2d5a7a' : '#000d20',
                    border: '1px solid rgba(14,165,233,0.4)',
                  }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {loading ? 'Loading' : 'Pull Stats'}
                </button>
              </div>
              <p className="text-xs mt-2 mono" style={{ color: '#2d5a7a' }}>
                Career profile must be public: Overwatch → Options → Social → Career Profile Visibility.
              </p>
            </div>

            {error && (
              <div className="px-4 py-3 flex items-start gap-3"
                style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}>
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                <div className="text-sm" style={{ color: '#fca5a5' }}>{error}</div>
              </div>
            )}

            {/* Settings */}
            <div>
              <button onClick={() => setShowSettings(v => !v)}
                className="flex items-center gap-2 text-xs mono uppercase tracking-wider transition-colors"
                style={{ color: showSettings ? '#38bdf8' : '#2d5a7a' }}>
                <Settings className="w-3.5 h-3.5" />
                {showSettings ? 'hide settings' : 'settings'}
                {proxyUrl && !showSettings && <span style={{ color: '#34d399' }} className="normal-case">· proxy override active</span>}
              </button>
              {showSettings && (
                <div className="mt-3 p-4" style={{ border: '1px solid rgba(14,165,233,0.2)', background: 'rgba(0,18,35,0.5)' }}>
                  <label className="display text-xs uppercase tracking-[0.2em] block mb-2" style={{ color: 'rgba(56,189,248,0.7)' }}>Override Proxy URL</label>
                  <div className="flex gap-2">
                    <input type="text" value={proxyDraft} onChange={e => setProxyDraft(e.target.value)}
                      placeholder="Leave blank to use default"
                      className="mono flex-1 px-3 py-2 text-sm transition-colors"
                      style={{ background: 'rgba(0,18,35,0.8)', border: '1px solid rgba(14,165,233,0.2)', color: '#e0f2fe', outline: 'none' }} />
                    <button onClick={saveProxy}
                      className="display tracking-wider uppercase text-xs font-semibold px-4 py-2 transition-colors flex items-center gap-2"
                      style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)', color: '#38bdf8' }}>
                      {proxySaved ? <><Check className="w-3.5 h-3.5" />saved</> : 'save'}
                    </button>
                  </div>
                  <div className="mt-3 pt-3 mono text-xs break-all" style={{ borderTop: '1px solid rgba(14,165,233,0.15)', color: '#2d5a7a' }}>
                    <span className="uppercase tracking-wider mr-2" style={{ color: '#1e4060' }}>active base url</span>{apiBase}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profile + stats */}
        {profile && (
          <div className="space-y-8">

            {/* Profile card */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pb-6"
              style={{ borderBottom: '1px solid rgba(14,165,233,0.15)' }}>
              {profile.avatar
                ? <img src={profile.avatar} alt="" className="w-20 h-20 flex-shrink-0"
                    style={{ border: '2px solid rgba(14,165,233,0.5)' }} />
                : <div className="w-20 h-20 flex items-center justify-center flex-shrink-0"
                    style={{ border: '2px solid rgba(14,165,233,0.5)', background: 'rgba(0,18,35,0.8)' }}>
                    <Shield className="w-8 h-8" style={{ color: 'rgba(14,165,233,0.6)' }} />
                  </div>}
              <div className="flex-1 min-w-0">
                <div className="display text-3xl font-bold truncate" style={{ color: '#e0f2fe' }}>{profile.username}</div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm" style={{ color: '#4d7a9a' }}>
                  {profile.title && <span>{profile.title}</span>}
                  {profile.endorsement?.level && <span className="mono">END {profile.endorsement.level}</span>}
                  <span className="mono uppercase">{platform}</span>
                </div>
              </div>
              <button onClick={reset} className="p-2 self-start sm:self-center transition-colors"
                style={{ color: '#2d5a7a' }}
                onMouseEnter={e => e.currentTarget.style.color = '#38bdf8'}
                onMouseLeave={e => e.currentTarget.style.color = '#2d5a7a'}
                title="New search">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Hero highlights: top 3 / bottom 3 by winrate */}
            {(heroHighlights.top.length > 0 || heroHighlights.bottom.length > 0) && (
              <div className="p-5" style={{
                background: 'rgba(0,13,28,0.7)',
                border: '1px solid rgba(14,165,233,0.18)',
              }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="display text-xs uppercase tracking-[0.3em]" style={{ color: '#38bdf8' }}>
                    {heroHighlights.allSeason ? 'All Seasons' : 'Current Season'} · Hero Winrates
                  </div>
                  <div className="h-px flex-1" style={{ background: 'rgba(14,165,233,0.15)' }} />
                  <div className="mono text-xs" style={{ color: '#2d5a7a' }}>
                    {heroHighlights.allSeason ? 'all seasons' : 'current season'}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">

                  {/* Top 3 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
                      <span className="display text-xs uppercase tracking-[0.2em]" style={{ color: '#34d399' }}>Best Heroes</span>
                    </div>
                    <div className="space-y-2">
                      {heroHighlights.top.map((h, i) => {
                        const role = HERO_ROLES[h.hero];
                        return (
                          <div key={h.hero} className="flex items-center justify-between px-3 py-2"
                            style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="mono text-xs w-4 text-right flex-shrink-0" style={{ color: '#2d5a7a' }}>{i + 1}</span>
                              <div className="min-w-0">
                                <div className="display font-semibold truncate" style={{ color: '#e0f2fe', fontSize: '0.95rem' }}>
                                  {HERO_DISPLAY[h.hero] || h.hero}
                                </div>
                                <div className="mono text-xs" style={{ color: '#4d7a9a' }}>
                                  {role === 'damage' ? 'dps' : role ?? 'flex'}{h.pickrate != null ? ` · ${Math.round(h.pickrate)}% pick` : ''}
                                </div>
                              </div>
                            </div>
                            <div className="display font-bold flex-shrink-0 ml-2"
                              style={{ color: '#34d399', fontSize: '1.1rem' }}>
                              {Math.round(h.winrate)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom 3 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="w-3.5 h-3.5" style={{ color: '#f87171' }} />
                      <span className="display text-xs uppercase tracking-[0.2em]" style={{ color: '#f87171' }}>Focus Areas</span>
                    </div>
                    <div className="space-y-2">
                      {heroHighlights.bottom.map((h, i) => {
                        const role = HERO_ROLES[h.hero];
                        return (
                          <div key={h.hero} className="flex items-center justify-between px-3 py-2"
                            style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="mono text-xs w-4 text-right flex-shrink-0" style={{ color: '#2d5a7a' }}>{i + 1}</span>
                              <div className="min-w-0">
                                <div className="display font-semibold truncate" style={{ color: '#e0f2fe', fontSize: '0.95rem' }}>
                                  {HERO_DISPLAY[h.hero] || h.hero}
                                </div>
                                <div className="mono text-xs" style={{ color: '#4d7a9a' }}>
                                  {role === 'damage' ? 'dps' : role ?? 'flex'}{h.pickrate != null ? ` · ${Math.round(h.pickrate)}% pick` : ''}
                                </div>
                              </div>
                            </div>
                            <div className="display font-bold flex-shrink-0 ml-2"
                              style={{ color: '#f87171', fontSize: '1.1rem' }}>
                              {Math.round(h.winrate)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Queue tabs */}
            <div>
              <div className="display text-xs uppercase tracking-[0.3em] mb-3" style={{ color: 'rgba(56,189,248,0.7)' }}>Select Queue</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {QUEUES.map(q => {
                  const r = ranks[q.apiKey];
                  const isActive = selectedQueue === q.key;
                  const tierColor = TIER_COLORS[r?.division?.toLowerCase?.()] || '#2d5a7a';
                  return (
                    <button key={q.key} onClick={() => { setSelectedQueue(q.key); setCoaching(null); }}
                      className="text-left px-4 py-3 transition-all"
                      style={{
                        background: isActive ? 'rgba(14,165,233,0.1)' : 'rgba(0,18,35,0.5)',
                        border: isActive ? '1px solid rgba(14,165,233,0.6)' : '1px solid rgba(14,165,233,0.15)',
                      }}>
                      <div className="display text-sm uppercase tracking-wider mb-1"
                        style={{ color: isActive ? '#38bdf8' : '#4d7a9a' }}>{q.label}</div>
                      <div className="display text-xl font-bold uppercase" style={{ color: r ? tierColor : '#1e4060' }}>
                        {r ? `${r.division ?? '?'} ${r.tier ?? ''}`.trim() : 'Unranked'}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedQueue === 'open' && openQueueError && (
                <div className="mt-2 flex items-center gap-3 px-3 py-2"
                  style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#fbbf24' }} />
                  <span className="text-xs mono flex-1" style={{ color: '#fbbf24' }}>{openQueueError}</span>
                  <button onClick={retryOpenQueue} className="mono text-xs uppercase tracking-wider transition-colors"
                    style={{ color: '#38bdf8' }}>retry</button>
                </div>
              )}
            </div>

            {/* Hero grid */}
            {visibleHeroStats.length > 0 ? (
              <div>
                <div className="flex items-baseline gap-3 mb-4">
                  <h2 className="display text-2xl font-bold" style={{ color: '#e0f2fe' }}>
                    {selectedQueue === 'open' ? 'All Heroes' : `${queueLabel} Heroes`}
                  </h2>
                  <div className="h-px flex-1" style={{ background: 'rgba(14,165,233,0.15)' }} />
                  <span className="mono text-xs" style={{ color: '#2d5a7a' }}>{visibleHeroStats.length} played</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {visibleHeroStats.slice(0, 8).map(h => {
                    const cellRole = selectedQueue === 'open' ? h.role : selectedQueue;
                    const cells = statsForRole(h, cellRole);
                    return (
                      <div key={h.hero} className="p-4 transition-all"
                        style={{ background: 'rgba(0,18,35,0.55)', border: '1px solid rgba(14,165,233,0.15)' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(14,165,233,0.4)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(14,165,233,0.15)'}>
                        <div className="flex items-baseline justify-between mb-3 gap-2">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <div className="display text-xl font-semibold truncate" style={{ color: '#e0f2fe' }}>
                              {HERO_DISPLAY[h.hero] || h.hero}
                            </div>
                            {selectedQueue === 'open' && h.role !== 'unknown' && (
                              <div className="mono text-[10px] uppercase tracking-wider" style={{ color: '#2d5a7a' }}>
                                {h.role === 'damage' ? 'dps' : h.role}
                              </div>
                            )}
                          </div>
                          <div className="mono text-xs flex-shrink-0" style={{ color: '#2d5a7a' }}>{fmtTime(h.timePlayed)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          {cells.map((c, i) => (
                            <div key={i} className="flex justify-between">
                              <span style={{ color: '#2d5a7a' }}>{c.label}</span>
                              <span className={`mono ${TONE[c.tone] || TONE.default}`}>{c.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm px-4 py-3 mono" style={{ color: '#2d5a7a', border: '1px solid rgba(14,165,233,0.12)' }}>
                {selectedQueue === 'open' && openQueueError
                  ? openQueueError
                  : `No ${queueLabel} stats found — try Open Queue or a different queue.`}
              </div>
            )}

            {/* Coaching */}
            <div className="p-6" style={{ border: '1px solid rgba(14,165,233,0.25)', background: 'rgba(14,165,233,0.04)' }}>
              <div className="flex items-baseline gap-3 mb-4">
                <Brain className="w-5 h-5" style={{ color: '#0ea5e9' }} />
                <h2 className="display text-xl uppercase tracking-wider" style={{ color: '#e0f2fe' }}>
                  Coaching Brief · {queueLabel}
                </h2>
              </div>
              <button onClick={askCoach} disabled={coachingLoading || !visibleHeroStats.length}
                className="mt-3 display tracking-wider uppercase font-semibold px-6 py-3 transition-all flex items-center gap-2"
                style={{
                  background: coachingLoading || !visibleHeroStats.length ? 'rgba(14,165,233,0.08)' : '#0ea5e9',
                  color: coachingLoading || !visibleHeroStats.length ? '#2d5a7a' : '#000d20',
                  border: '1px solid rgba(14,165,233,0.35)',
                }}>
                {coachingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {coachingLoading ? 'Analysing' : 'Get Coaching'}
              </button>
              {coachingError && (
                <div className="mt-3 px-4 py-3 flex items-start gap-3"
                  style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.07)' }}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                  <div className="text-sm" style={{ color: '#fca5a5' }}>{coachingError}</div>
                </div>
              )}
            </div>

            {/* Coaching response */}
            {coaching && (
              <div className="space-y-7">
                <div className="pt-6" style={{ borderTop: '2px solid rgba(14,165,233,0.35)' }}>
                  <div className="display text-xs uppercase tracking-[0.3em] mb-2" style={{ color: 'rgba(56,189,248,0.8)' }}>
                    Diagnosis · {queueLabel}
                  </div>
                  <p className="leading-relaxed" style={{ color: '#c8e6f5' }}>{coaching.diagnosis}</p>
                </div>
                {coaching.priorities?.length > 0 && (
                  <div>
                    <div className="display text-xs uppercase tracking-[0.3em] mb-3" style={{ color: 'rgba(56,189,248,0.8)' }}>Priorities</div>
                    <div className="space-y-3">
                      {coaching.priorities.map((p, i) => (
                        <div key={i} className="pl-4 py-1" style={{ borderLeft: '2px solid rgba(14,165,233,0.5)' }}>
                          <div className="flex items-baseline gap-3 mb-1">
                            <span className="mono text-xs" style={{ color: 'rgba(56,189,248,0.6)' }}>{String(i + 1).padStart(2, '0')}</span>
                            <div className="display text-lg font-semibold" style={{ color: '#e0f2fe' }}>{p.title}</div>
                          </div>
                          <p className="text-sm leading-relaxed mb-2" style={{ color: '#7aadcc' }}>{p.why}</p>
                          {p.drill && (
                            <div className="text-xs px-3 py-2 leading-relaxed"
                              style={{ color: '#7aadcc', background: 'rgba(0,18,35,0.6)', border: '1px solid rgba(14,165,233,0.15)' }}>
                              <span className="display tracking-wider uppercase mr-2" style={{ color: 'rgba(56,189,248,0.7)' }}>Drill</span>
                              {p.drill}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {coaching.hero_tips?.length > 0 && (
                  <div>
                    <div className="display text-xs uppercase tracking-[0.3em] mb-3" style={{ color: 'rgba(56,189,248,0.8)' }}>Hero-Specific</div>
                    <div className="space-y-3">
                      {coaching.hero_tips.map((h, i) => (
                        <div key={i} className="p-4" style={{ background: 'rgba(0,18,35,0.55)', border: '1px solid rgba(14,165,233,0.15)' }}>
                          <div className="display text-lg mb-2" style={{ color: '#38bdf8' }}>{h.hero}</div>
                          <ul className="space-y-1.5">
                            {h.tips?.map((t, j) => (
                              <li key={j} className="flex gap-2 text-sm leading-relaxed" style={{ color: '#7aadcc' }}>
                                <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgba(56,189,248,0.5)' }} />
                                <span>{t}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {coaching.vod_focus && (
                  <div>
                    <div className="display text-xs uppercase tracking-[0.3em] mb-2" style={{ color: 'rgba(56,189,248,0.8)' }}>VOD Review Focus</div>
                    <p className="leading-relaxed text-sm" style={{ color: '#c8e6f5' }}>{coaching.vod_focus}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-16 pt-6 flex flex-wrap items-center justify-between gap-2"
          style={{ borderTop: '1px solid rgba(14,165,233,0.1)' }}>
          <div className="mono text-xs" style={{ color: '#1e4060' }}>data: overfast-api · coach: rules engine</div>
          <div className="mono text-xs" style={{ color: '#1e4060' }}>not affiliated with blizzard</div>
        </div>
      </div>
    </div>
  );
}
