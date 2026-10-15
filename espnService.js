const axios = require('axios');

const LEAGUES = [
    // Top Eropa & Domestik Cup
    { slug: 'eng.1', name: 'Premier League', region: 'England', fdId: 2021, defaultTv: 'Vidio, Champions TV' },
    { slug: 'esp.1', name: 'La Liga', region: 'Spain', fdId: 2014, defaultTv: 'beIN Sports, Vidio' },
    { slug: 'ita.1', name: 'Serie A', region: 'Italy', fdId: 2019, defaultTv: 'beIN Sports, Vidio' },
    { slug: 'ger.1', name: 'Bundesliga', region: 'Germany', fdId: 2002, defaultTv: 'Vision+, RCTI' },
    { slug: 'fra.1', name: 'Ligue 1', region: 'France', fdId: 2015, defaultTv: 'beIN Sports, Vidio' },
    { slug: 'ned.1', name: 'Eredivisie', region: 'Netherlands', fdId: 2003, defaultTv: 'Mola TV' },
    { slug: 'por.1', name: 'Liga Portugal', region: 'Portugal', fdId: 2017, defaultTv: 'Mola TV' },
    { slug: 'tur.1', name: 'Süper Lig', region: 'Turkey', fdId: null, defaultTv: 'beIN Sports' },
    { slug: 'eng.2', name: 'Championship', region: 'England', fdId: 2016, defaultTv: 'Vidio' },
    { slug: 'eng.fa', name: 'FA Cup', region: 'England', fdId: null, defaultTv: 'beIN Sports, Vidio' },
    { slug: 'eng.league_cup', name: 'Carabao Cup', region: 'England', fdId: 2146, defaultTv: 'Mola TV' },
    { slug: 'esp.copa_del_rey', name: 'Copa del Rey', region: 'Spain', fdId: 2079, defaultTv: 'RCTI, Vision+' },
    { slug: 'ita.coppa_italia', name: 'Coppa Italia', region: 'Italy', fdId: null, defaultTv: 'TVRI Sport' },

    // Kompetisi Klub Dunia & Eropa
    { slug: 'uefa.champions', name: 'UEFA Champions League', region: 'Europe', fdId: 2001, defaultTv: 'beIN Sports, Vidio' },
    { slug: 'uefa.europa', name: 'UEFA Europa League', region: 'Europe', fdId: 2146, defaultTv: 'beIN Sports, Vidio' },
    { slug: 'uefa.europa.conf', name: 'UEFA Conference League', region: 'Europe', fdId: null, defaultTv: 'beIN Sports, Vidio' },
    { slug: 'fifa.cwc', name: 'FIFA Club World Cup', region: 'World', fdId: null, defaultTv: 'Vision+, SPOTV' },

    // Liga Magnet Bintang & Tier-1 eCPM
    { slug: 'usa.1', name: 'Major League Soccer', region: 'USA', fdId: null, defaultTv: 'Apple TV (MLS Season Pass)' },
    { slug: 'ksa.1', name: 'Saudi Pro League', region: 'Saudi Arabia', fdId: null, defaultTv: 'SPOTV, Vidio' },
    { slug: 'jpn.1', name: 'J1 League', region: 'Japan', fdId: null, defaultTv: 'YouTube J.League International' },
    { slug: 'mex.1', name: 'Liga MX', region: 'Mexico', fdId: null, defaultTv: 'TUDN, Univision' },
    { slug: 'bra.1', name: 'Brasileirão', region: 'Brazil', fdId: 2013, defaultTv: 'Premiere, SporTV' },
    { slug: 'arg.1', name: 'Liga Profesional de Fútbol', region: 'Argentina', fdId: null, defaultTv: 'Fanatiz' },

    // Liga Magnet Traffic Indonesia & Asia
    { slug: 'idn.1', name: 'Liga 1 Indonesia', region: 'Indonesia', fdId: null, defaultTv: 'Indosiar, Vidio' },
    { slug: 'aff.championship', name: 'Piala AFF', region: 'ASEAN', fdId: null, defaultTv: 'RCTI, Vision+, iNews' },
    { slug: 'afc.champions', name: 'AFC Champions League Elite', region: 'Asia', fdId: null, defaultTv: 'RCTI+, Vision+' },
    { slug: 'afc.cup', name: 'AFC Champions League Two', region: 'Asia', fdId: null, defaultTv: 'RCTI+, Vision+' },

    // Timnas & Kualifikasi Piala Dunia
    { slug: 'fifa.worldq.afc', name: 'FIFA World Cup Qualifying - AFC', region: 'Asia', fdId: null, defaultTv: 'RCTI, Vision+, GTV' },
    { slug: 'fifa.worldq.uefa', name: 'FIFA World Cup Qualifying - UEFA', region: 'Europe', fdId: null, defaultTv: 'Vision+, RCTI' },
    { slug: 'fifa.worldq.conmebol', name: 'FIFA World Cup Qualifying - CONMEBOL', region: 'South America', fdId: null, defaultTv: 'Fanatiz' },
    { slug: 'afc.asian.cup', name: 'AFC Asian Cup', region: 'Asia', fdId: null, defaultTv: 'RCTI, Vision+, iNews' },
    { slug: 'uefa.nations', name: 'UEFA Nations League', region: 'Europe', fdId: null, defaultTv: 'Vision+, RCTI' },
    { slug: 'fifa.friendly', name: 'International Friendly', region: 'World', fdId: null, defaultTv: 'RCTI, Indosiar' },
    { slug: 'fifa.world', name: 'FIFA World Cup', region: 'World', fdId: 2000, defaultTv: 'SCTV, Indosiar, Vidio' }
];

const LEAGUES_BY_SLUG = new Map(LEAGUES.map(l => [l.slug, l]));
const LEAGUES_BY_FD_ID = new Map(LEAGUES.filter(l => l.fdId).map(l => [l.fdId, l]));

function getLeagueBySlug(slug) {
    return LEAGUES_BY_SLUG.get(slug) || null;
}

function getLeagueByFootballDataId(id) {
    return LEAGUES_BY_FD_ID.get(id) || null;
}

function findSlugByLeagueName(leagueName) {
    if (!leagueName) return null;
    const lower = leagueName.toLowerCase().trim();
    for (const l of LEAGUES) {
        if (l.name.toLowerCase() === lower || lower.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(lower)) {
            return l.slug;
        }
    }
    // Specific keywords
    if (lower.includes('premier league') || lower.includes('premier')) return 'eng.1';
    if (lower.includes('la liga') || lower.includes('laliga') || lower.includes('primera division')) return 'esp.1';
    if (lower.includes('serie a') || lower.includes('italian')) return 'ita.1';
    if (lower.includes('bundesliga')) return 'ger.1';
    if (lower.includes('ligue 1')) return 'fra.1';
    if (lower.includes('eredivisie')) return 'ned.1';
    if (lower.includes('championship')) return 'eng.2';
    if (lower.includes('champions league') || lower.includes('ucl')) return 'uefa.champions';
    if (lower.includes('europa league') || lower.includes('uel')) return 'uefa.europa';
    if (lower.includes('conference league')) return 'uefa.europa.conf';
    if (lower.includes('liga 1') || lower.includes('indonesia')) return 'idn.1';
    if (lower.includes('saudi') || lower.includes('pro league')) return 'ksa.1';
    if (lower.includes('mls') || lower.includes('major league soccer')) return 'usa.1';
    if (lower.includes('brasileir') || lower.includes('brazil')) return 'bra.1';
    if (lower.includes('argentin')) return 'arg.1';
    if (lower.includes('nations league')) return 'uefa.nations';
    if (lower.includes('world cup')) return 'fifa.world';
    return null;
}

function normalizeTeamName(name) {
    if (!name) return "";
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\b(fc|cf|rc|sk|fk|ac|as|ssc|bv|afc|cp|cd|sc|bsc)\b/gi, "")
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function teamsMatch(nameA, nameB) {
    const a = normalizeTeamName(nameA);
    const b = normalizeTeamName(nameB);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    
    const wordsA = a.split(' ').filter(w => w.length > 2);
    const wordsB = b.split(' ').filter(w => w.length > 2);
    for (const wa of wordsA) {
        for (const wb of wordsB) {
            if (wa === wb) return true;
        }
    }
    return false;
}

function parseBroadcastTv(comp, defaultTv = '') {
    const tvSet = new Set();
    if (Array.isArray(comp.broadcasts)) {
        for (const b of comp.broadcasts) {
            if (Array.isArray(b.names)) {
                b.names.forEach(n => { if (n && n.trim()) tvSet.add(n.trim()); });
            }
        }
    }
    if (Array.isArray(comp.geoBroadcasts)) {
        for (const gb of comp.geoBroadcasts) {
            const name = (gb.media && (gb.media.shortName || gb.media.name)) || gb.station;
            if (name && name.trim()) tvSet.add(name.trim());
        }
    }
    if (tvSet.size > 0) {
        return Array.from(tvSet).slice(0, 3).join(', ');
    }
    return defaultTv || '';
}

function extractMatchDetails(comp) {
    if (!comp) return null;
    
    const homeComp = (comp.competitors || []).find(c => c.homeAway === 'home');
    const awayComp = (comp.competitors || []).find(c => c.homeAway === 'away');
    const homeTeamId = homeComp ? homeComp.id : null;
    const awayTeamId = awayComp ? awayComp.id : null;

    const timeline = [];
    const rawDetails = comp.details || [];
    
    for (const d of rawDetails) {
        let typeText = d.type ? d.type.text : 'Event';
        if (d.penaltyKick && !typeText.toLowerCase().includes('penalty')) {
            typeText = 'Penalty Goal';
        } else if (d.ownGoal && !typeText.toLowerCase().includes('own goal')) {
            typeText = 'Own Goal';
        } else if (d.redCard) {
            typeText = 'Red Card';
        } else if (d.yellowCard) {
            typeText = 'Yellow Card';
        }

        const minute = (d.clock && d.clock.displayValue) ? d.clock.displayValue : '';
        const athlete = (d.athletesInvolved && d.athletesInvolved[0]) ? d.athletesInvolved[0].displayName : '';
        
        let side = 'unknown';
        if (d.team && d.team.id) {
            if (d.team.id === homeTeamId) side = 'home';
            else if (d.team.id === awayTeamId) side = 'away';
        }

        timeline.push({
            minute: minute || "FT",
            player: athlete || "",
            type: typeText || "Event",
            side: side
        });
    }

    const parseStatVal = (statList, name) => {
        const item = (statList || []).find(s => s.name === name);
        if (!item || item.displayValue === undefined || item.displayValue === null) return 0;
        return parseFloat(item.displayValue) || 0;
    };

    const homeStats = homeComp ? homeComp.statistics || [] : [];
    const awayStats = awayComp ? awayComp.statistics || [] : [];

    const homePossession = parseStatVal(homeStats, 'possessionPct');
    const awayPossession = parseStatVal(awayStats, 'possessionPct');

    const homeTotalShots = parseStatVal(homeStats, 'totalShots');
    const awayTotalShots = parseStatVal(awayStats, 'totalShots');

    const homeShotsOnTarget = parseStatVal(homeStats, 'shotsOnTarget') || parseStatVal(homeStats, 'shotsOnGoal');
    const awayShotsOnTarget = parseStatVal(awayStats, 'shotsOnTarget') || parseStatVal(awayStats, 'shotsOnGoal');

    const homeCorners = parseStatVal(homeStats, 'wonCorners');
    const awayCorners = parseStatVal(awayStats, 'wonCorners');

    const homeFouls = parseStatVal(homeStats, 'foulsCommitted');
    const awayFouls = parseStatVal(awayStats, 'foulsCommitted');

    const hasAnyStats = (homePossession > 0 || awayPossession > 0 || homeTotalShots > 0 || awayTotalShots > 0 || homeCorners > 0 || awayCorners > 0);

    if (timeline.length === 0 && !hasAnyStats) {
        return null;
    }

    return {
        timeline: timeline,
        stats: hasAnyStats ? {
            possession: { home: Math.round(homePossession), away: Math.round(awayPossession) },
            totalShots: { home: Math.round(homeTotalShots), away: Math.round(awayTotalShots) },
            shotsOnTarget: { home: Math.round(homeShotsOnTarget), away: Math.round(awayShotsOnTarget) },
            corners: { home: Math.round(homeCorners), away: Math.round(awayCorners) },
            fouls: { home: Math.round(homeFouls), away: Math.round(awayFouls) }
        } : null
    };
}

function generateMatchInsights(fixtureId, homeTeam, awayTeam) {
    const seedStr = `${fixtureId}_${homeTeam}_${awayTeam}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
        hash |= 0;
    }
    const positiveHash = Math.abs(hash);
    
    // Draw probability between 20% and 28%
    const draw = 20 + (positiveHash % 9);
    const remaining = 100 - draw;
    
    // Home advantage ~55% with deterministic variance [-8, +8]
    const variance = ((positiveHash >> 3) % 17) - 8;
    let homeWin = Math.round(remaining * 0.55) + variance;
    
    if (homeWin < 20) homeWin = 20;
    if (homeWin > (remaining - 15)) homeWin = remaining - 15;
    
    const awayWin = remaining - homeWin;
    
    return {
        homeWin: homeWin,
        draw: draw,
        awayWin: awayWin
    };
}

function espnEventToFirebaseMatch(ev, leagueConfig) {
    if (!ev || !ev.competitions || ev.competitions.length === 0) return null;
    const comp = ev.competitions[0];
    const homeComp = (comp.competitors || []).find(c => c.homeAway === 'home');
    const awayComp = (comp.competitors || []).find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) return null;

    const fixtureId = ev.id.toString();
    const homeTeam = homeComp.team.displayName || homeComp.team.name || "Home";
    const awayTeam = awayComp.team.displayName || awayComp.team.name || "Away";

    // Map status
    const espnState = (ev.status && ev.status.type && ev.status.type.state) || 'pre';
    const espnName = (ev.status && ev.status.type && ev.status.type.name) || '';
    let status = 'TIMED';
    let elapsed = 0;

    if (espnState === 'in') {
        if (espnName === 'STATUS_HALFTIME') {
            status = 'PAUSED';
            elapsed = 45;
        } else {
            status = 'IN_PLAY';
            if (ev.status.clock) {
                elapsed = Math.round(ev.status.clock / 60);
            } else if (ev.status.displayClock) {
                elapsed = parseInt(ev.status.displayClock) || 0;
            }
        }
    } else if (espnState === 'post') {
        status = 'FINISHED';
        elapsed = 90;
    } else {
        if (espnName.includes('POSTPONED')) status = 'POSTPONED';
        else if (espnName.includes('CANCELED')) status = 'CANCELLED';
        else status = 'TIMED';
    }

    const homeGoals = parseInt(homeComp.score || 0);
    const awayGoals = parseInt(awayComp.score || 0);
    const timestamp = new Date(ev.date).getTime();
    const tv = parseBroadcastTv(comp, leagueConfig ? leagueConfig.defaultTv : '');
    const insights = generateMatchInsights(fixtureId, homeTeam, awayTeam);
    const matchDetails = extractMatchDetails(comp);

    return {
        id: fixtureId,
        league: (leagueConfig && leagueConfig.name) || ev.league?.name || "Football",
        league_slug: (leagueConfig && leagueConfig.slug) || "",
        home_team: homeTeam,
        home_logo: homeComp.team.logo || "",
        home_goals: homeGoals,
        away_team: awayTeam,
        away_logo: awayComp.team.logo || "",
        away_goals: awayGoals,
        status: status,
        elapsed: elapsed,
        timestamp: timestamp,
        utcDate: ev.date,
        tv: tv,
        insights: insights,
        matchDetails: matchDetails || null
    };
}

async function fetchEspnScoreboard(slug, dateStr = null) {
    try {
        const dateParam = dateStr ? `?dates=${dateStr}` : '';
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard${dateParam}`;
        const res = await axios.get(url, { timeout: 6000 });
        const events = res.data.events || [];
        const leagueConfig = getLeagueBySlug(slug);
        return {
            slug: slug,
            leagueConfig: leagueConfig,
            rawEvents: events,
            matches: events.map(ev => espnEventToFirebaseMatch(ev, leagueConfig)).filter(Boolean)
        };
    } catch (e) {
        return {
            slug: slug,
            leagueConfig: getLeagueBySlug(slug),
            rawEvents: [],
            matches: []
        };
    }
}

async function fetchEspnScoreboardsBatched(slugs, dateStr = null, batchSize = 5, delayMs = 200) {
    const allResults = [];
    for (let i = 0; i < slugs.length; i += batchSize) {
        const chunk = slugs.slice(i, i + batchSize);
        const promises = chunk.map(s => fetchEspnScoreboard(s, dateStr));
        const settled = await Promise.allSettled(promises);
        for (const res of settled) {
            if (res.status === 'fulfilled') {
                allResults.push(res.value);
            }
        }
        if (i + batchSize < slugs.length && delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return allResults;
}

function findMatchDetails(homeTeam, awayTeam, espnEvents) {
    if (!espnEvents || espnEvents.length === 0) return null;
    for (const ev of espnEvents) {
        const comp = ev.competitions && ev.competitions[0];
        if (!comp || !comp.competitors || comp.competitors.length < 2) continue;
        const espnHome = comp.competitors.find(c => c.homeAway === 'home');
        const espnAway = comp.competitors.find(c => c.homeAway === 'away');
        if (!espnHome || !espnAway) continue;

        const homeName = espnHome.team.name || espnHome.team.displayName || "";
        const awayName = espnAway.team.name || espnAway.team.displayName || "";

        if (teamsMatch(homeTeam, homeName) && teamsMatch(awayTeam, awayName)) {
            return extractMatchDetails(comp);
        }
    }
    return null;
}

module.exports = {
    LEAGUES,
    getLeagueBySlug,
    getLeagueByFootballDataId,
    findSlugByLeagueName,
    normalizeTeamName,
    teamsMatch,
    parseBroadcastTv,
    extractMatchDetails,
    generateMatchInsights,
    espnEventToFirebaseMatch,
    fetchEspnScoreboard,
    fetchEspnScoreboardsBatched,
    findMatchDetails
};
