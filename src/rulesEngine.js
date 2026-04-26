import rulesData from './ow2_coaching_rules.json';

const RULES_DB = rulesData.rules;

const priorityMap = { critical: 100, high: 75, medium: 50, low: 25 };

const evaluateCondition = (condition, stats) => {
  if (!condition) return true;

  if (condition.compound === 'AND') {
    return condition.conditions.every(c => evaluateCondition(c, stats));
  }
  if (condition.compound === 'OR') {
    return condition.conditions.some(c => evaluateCondition(c, stats));
  }

  const statValue = stats[condition.stat];
  if (statValue === null || statValue === undefined) return false;

  switch (condition.op) {
    case '>':       return statValue > condition.value;
    case '<':       return statValue < condition.value;
    case '>=':      return statValue >= condition.value;
    case '<=':      return statValue <= condition.value;
    case '==':      return statValue === condition.value;
    case 'between': return statValue >= condition.value[0] && statValue <= condition.value[1];
    default:        return false;
  }
};

const ruleScopesApply = (ruleScopes, targetRole) => {
  if (!ruleScopes) return false;
  if (typeof ruleScopes === 'string') return ruleScopes === targetRole || ruleScopes === 'universal';
  if (Array.isArray(ruleScopes)) return ruleScopes.includes(targetRole) || ruleScopes.includes('universal');
  return false;
};

const heroDisplayName = (key) => {
  const overrides = {
    'soldier-76': 'Soldier: 76', 'd-va': 'D.Va',
    'junker-queen': 'Junker Queen', 'wrecking-ball': 'Wrecking Ball',
  };
  return overrides[key] || key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const statsFromHero = (hero) => ({
  deathsPer10:     hero.deathsPer10     ?? 0,
  elimsPer10:      hero.elimsPer10      ?? 0,
  finalBlowsPer10: hero.finalBlowsPer10 ?? 0,
  healingPer10:    hero.healingPer10    ?? 0,
  damagePer10:     hero.damagePer10     ?? 0,
  critAcc:         hero.critAcc         ?? 0,
  winrate:         hero.winrate         ?? 0,
  gamesPlayed:     hero.gamesPlayed     ?? 0,
});

export const evaluateRulesEngine = (role, topHeroes, allHeroStats, rank, gamesPlayed) => {
  const stats = {
    ...statsFromHero(topHeroes[0] || {}),
    winrate: topHeroes.reduce((sum, h) => sum + (h.winrate || 0), 0) / Math.max(1, topHeroes.length),
    gamesPlayed: gamesPlayed || 0,
  };

  const rankTier = rank?.division?.toLowerCase?.() || 'unranked';

  // Bug 1 fix: JSON stores open queue rules under 'open_queue', role key is 'open'
  const ruleKey = role === 'open' ? 'open_queue' : role;

  const firedRules = [];

  (RULES_DB.universal || []).forEach(rule => {
    if (rule.min_games && gamesPlayed < rule.min_games) return;
    if (evaluateCondition(rule.condition, stats)) firedRules.push(rule);
  });

  (RULES_DB[ruleKey] || []).forEach(rule => {
    if (rule.min_games && gamesPlayed < rule.min_games) return;
    if (rule.ranks && !rule.ranks.includes(rankTier)) return;
    if (evaluateCondition(rule.condition, stats)) firedRules.push(rule);
  });

  (RULES_DB.cross_stat_patterns || []).forEach(rule => {
    if (rule.min_games && gamesPlayed < rule.min_games) return;
    if (!ruleScopesApply(rule.scope, role)) return;
    if (evaluateCondition(rule.condition, stats)) firedRules.push(rule);
  });

  firedRules.sort((a, b) => (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0));

  const seenCategories = new Set();
  const uniqueRules = [];
  for (const rule of firedRules) {
    if (!seenCategories.has(rule.category)) {
      uniqueRules.push(rule);
      seenCategories.add(rule.category);
    }
  }

  const topRules = uniqueRules.slice(0, 3);

  // Evaluate all applicable rules per hero so every top-3 hero gets specific tips
  const heroTips = [];
  for (const hero of topHeroes.slice(0, 3)) {
    const heroStats = statsFromHero(hero);
    const heroGames = hero.gamesPlayed || 0;
    const fired = [];

    (RULES_DB.universal || []).forEach(rule => {
      if (rule.min_games && heroGames < rule.min_games) return;
      if (evaluateCondition(rule.condition, heroStats)) fired.push(rule);
    });

    (RULES_DB[ruleKey] || []).forEach(rule => {
      if (rule.min_games && heroGames < rule.min_games) return;
      if (rule.ranks && !rule.ranks.includes(rankTier)) return;
      if (evaluateCondition(rule.condition, heroStats)) fired.push(rule);
    });

    (RULES_DB.hero_specific?.[hero.hero] || []).forEach(rule => {
      if (evaluateCondition(rule.condition, heroStats)) fired.push(rule);
    });

    fired.sort((a, b) => (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0));

    const seenCats = new Set();
    const tips = [];
    for (const rule of fired) {
      if (!seenCats.has(rule.category)) {
        tips.push(rule.drill || rule.title);
        seenCats.add(rule.category);
        if (tips.length >= 2) break;
      }
    }

    if (tips.length === 0) {
      tips.push('No major stat issues detected — focus on consistency and decision-making.');
    }

    heroTips.push({ hero: heroDisplayName(hero.hero), tips });
  }

  return {
    diagnosis: topRules[0]?.why || 'No major stat patterns detected across your top heroes. See per-hero breakdown below.',
    priorities: topRules.map(rule => ({ title: rule.title, why: rule.why, drill: rule.drill })),
    hero_tips: heroTips,
    vod_focus: topRules[0]?.vod_cue || 'Review your worst performance and identify the moment the game turned.',
    _firedRulesCount: firedRules.length,
  };
};
