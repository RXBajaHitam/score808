const axios = require('axios');

const ESPN_LEAGUES = [
    'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions', 'uefa.europa'
];

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

function extractMatchDetails(comp) {
    if (!comp) return null;
    
    const homeComp = (comp.competitors || []).find(c => c.homeAway === 'home');
    const awayComp = (comp.competitors || []).find(c => c.homeAway === 'away');
    const homeTeamId = homeComp ? homeComp.id : null;
    const awayTeamId = awayComp ? awayComp.id : null;

    const timeline = [];
    const rawDetails = comp.details || [];
    
    for (const d of rawDetails) {
        const typeText = d.type ? d.type.text : '';
        const minute = d.clock ? d.clock.displayValue : '';
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
        if (!item || !item.displayValue) return 0;
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

    const hasAnyStats = (homePossession > 0 || awayPossession > 0 || homeTotalShots > 0 || awayTotalShots > 0);

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

async function fetchEspnScoreboards(dateStr = null) {
    const dateParam = dateStr ? `?dates=${dateStr}` : '';
    const promises = ESPN_LEAGUES.map(slug => 
        axios.get(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard${dateParam}`, { timeout: 6000 })
            .then(res => res.data.events || [])
            .catch(() => [])
    );
    const results = await Promise.all(promises);
    return results.flat();
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
    fetchEspnScoreboards,
    findMatchDetails,
    normalizeTeamName,
    teamsMatch
};
