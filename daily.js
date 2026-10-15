require('dotenv').config({ path: '/root/score808/.env' });
const admin = require('firebase-admin');
const axios = require('axios');
const espnService = require('./espnService');

let serviceAccount;
try {
  serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : require('./serviceAccountKey.json');
} catch (e) {
  serviceAccount = require('./serviceAccountKey.json');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL || 'https://score808-59356-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}
const db = admin.database();

const apiKey = process.env.API_FOOTBALL_KEY;
const headers = apiKey ? { 'X-Auth-Token': apiKey } : {};

const comps = '2000,2001,2002,2003,2013,2014,2015,2016,2017,2018,2019,2021';

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

async function fetchDailyFixtures() {
    console.log(`=== START DAILY FIXTURES (34 LEAGUES SMART ESPN EXPANSION) ===`);
    const startTime = Date.now();
    try {
        const todayObj = new Date();
        const todayStr = formatDate(todayObj);
        
        // 1. Fetch football-data.org (10 days past, 10 days future)
        let fdMatches = [];
        try {
            const pastDateObj = new Date();
            pastDateObj.setDate(todayObj.getDate() - 10);
            const past10Days = formatDate(pastDateObj);
            
            const futureDateObj = new Date();
            futureDateObj.setDate(todayObj.getDate() + 10);
            const future10Days = formatDate(futureDateObj);
            
            console.log(`[FD.org] Mengambil data football-data.org (${past10Days} s/d ${future10Days})...`);
            const [resFinished, resUpcoming] = await Promise.all([
                axios.get(`https://api.football-data.org/v4/matches?dateFrom=${past10Days}&dateTo=${todayStr}&competitions=${comps}`, { headers, timeout: 8000 }).catch(e => ({ data: { matches: [] } })),
                axios.get(`https://api.football-data.org/v4/matches?dateFrom=${todayStr}&dateTo=${future10Days}&competitions=${comps}`, { headers, timeout: 8000 }).catch(e => ({ data: { matches: [] } }))
            ]);
            
            const allFd = [...(resFinished.data.matches || []), ...(resUpcoming.data.matches || [])];
            const uniqueFdMap = new Map();
            allFd.forEach(m => uniqueFdMap.set(m.id, m));
            fdMatches = Array.from(uniqueFdMap.values());
            console.log(`[FD.org] Berhasil memuat ${fdMatches.length} pertandingan dari football-data.org.`);
        } catch (err) {
            console.warn(`[FD.org] Gagal memuat football-data.org:`, err.message);
        }

        // 2. Fetch all 34 ESPN leagues in memory-safe batches of 5 with 200ms delay
        console.log(`[ESPN] Mengambil 34 liga ESPN secara batching hemat RAM...`);
        const allSlugs = espnService.LEAGUES.map(l => l.slug);
        const espnResults = await espnService.fetchEspnScoreboardsBatched(allSlugs, null, 5, 200);

        // Flatten all ESPN raw events and parsed matches
        const allEspnEvents = [];
        const allEspnMatches = [];
        for (const res of espnResults) {
            if (res.rawEvents && res.rawEvents.length > 0) {
                allEspnEvents.push(...res.rawEvents);
            }
            if (res.matches && res.matches.length > 0) {
                allEspnMatches.push(...res.matches);
            }
        }
        console.log(`[ESPN] Selesai memuat ${allEspnEvents.length} raw events dan ${allEspnMatches.length} matches dari ESPN.`);

        const upcomingData = {};
        const finishedData = {};
        let enrichedFdCount = 0;

        // 3. Process Football-Data.org matches (mapping & enriching)
        for (const match of fdMatches) {
            const fixtureId = match.id.toString();
            const status = match.status;
            const leagueConfig = espnService.getLeagueByFootballDataId(match.competition.id);
            const leagueSlug = leagueConfig ? leagueConfig.slug : espnService.findSlugByLeagueName(match.competition.name) || "";
            
            const insights = espnService.generateMatchInsights(fixtureId, match.homeTeam.name, match.awayTeam.name);
            const matchDetails = espnService.findMatchDetails(match.homeTeam.name, match.awayTeam.name, allEspnEvents);
            if (matchDetails) enrichedFdCount++;

            const defaultTv = leagueConfig ? leagueConfig.defaultTv : '';

            const matchObj = {
                id: fixtureId,
                league: match.competition.name,
                league_slug: leagueSlug,
                home_team: match.homeTeam.name,
                home_logo: match.homeTeam.crest || "",
                home_goals: (match.score && match.score.fullTime && match.score.fullTime.home !== null) ? match.score.fullTime.home : 0,
                away_team: match.awayTeam.name,
                away_logo: match.awayTeam.crest || "",
                away_goals: (match.score && match.score.fullTime && match.score.fullTime.away !== null) ? match.score.fullTime.away : 0,
                status: status,
                elapsed: status === 'FINISHED' ? 90 : 0,
                timestamp: new Date(match.utcDate).getTime(),
                utcDate: match.utcDate,
                tv: defaultTv,
                insights: insights,
                matchDetails: matchDetails || null
            };

            if (['SCHEDULED', 'TIMED', 'POSTPONED'].includes(status)) {
                upcomingData[fixtureId] = matchObj;
            } else if (['FINISHED', 'AWARDED'].includes(status)) {
                finishedData[fixtureId] = matchObj;
            }
        }

        console.log(`[Enrichment] Total pertandingan football-data diperkaya ESPN: ${enrichedFdCount}`);

        // Helper to check if match already exists in dictionary by teams
        const existsInDict = (dict, homeTeam, awayTeam) => {
            const h = espnService.normalizeTeamName(homeTeam);
            const a = espnService.normalizeTeamName(awayTeam);
            for (const key of Object.keys(dict)) {
                const item = dict[key];
                if (espnService.teamsMatch(h, item.home_team) && espnService.teamsMatch(a, item.away_team)) {
                    return key;
                }
            }
            return null;
        };

        // 4. Process ESPN native matches (Liga 1 Indonesia, Saudi, MLS, J1, AFC, Timnas WCQ, Cup competitions, etc.)
        let espnAddedUpcoming = 0;
        let espnAddedFinished = 0;

        for (const em of allEspnMatches) {
            const fixtureId = em.id;
            
            if (['TIMED', 'SCHEDULED', 'POSTPONED'].includes(em.status)) {
                const existingKey = existsInDict(upcomingData, em.home_team, em.away_team);
                if (existingKey) {
                    // Enrich existing entry if ESPN has more data (e.g. tv or details)
                    if (em.tv && !upcomingData[existingKey].tv) upcomingData[existingKey].tv = em.tv;
                    if (em.matchDetails && !upcomingData[existingKey].matchDetails) upcomingData[existingKey].matchDetails = em.matchDetails;
                    if (!upcomingData[existingKey].league_slug) upcomingData[existingKey].league_slug = em.league_slug;
                } else {
                    upcomingData[fixtureId] = em;
                    espnAddedUpcoming++;
                }
            } else if (['FINISHED', 'AWARDED'].includes(em.status)) {
                const existingKey = existsInDict(finishedData, em.home_team, em.away_team);
                if (existingKey) {
                    if (em.tv && !finishedData[existingKey].tv) finishedData[existingKey].tv = em.tv;
                    if (em.matchDetails && !finishedData[existingKey].matchDetails) finishedData[existingKey].matchDetails = em.matchDetails;
                    if (!finishedData[existingKey].league_slug) finishedData[existingKey].league_slug = em.league_slug;
                } else {
                    finishedData[fixtureId] = em;
                    espnAddedFinished++;
                }
            }
        }

        console.log(`[ESPN Native Added] Upcoming: ${espnAddedUpcoming}, Finished: ${espnAddedFinished}`);
        console.log(`[Total] Upcoming matches: ${Object.keys(upcomingData).length}`);
        console.log(`[Total] Finished matches: ${Object.keys(finishedData).length}`);

        // 5. Save to Firebase Realtime Database
        if (Object.keys(upcomingData).length > 0) {
            await db.ref("upcoming_matches").set(upcomingData);
            console.log(`Firebase: Sukses update ${Object.keys(upcomingData).length} upcoming matches.`);
        } else {
            console.log("Firebase: Tidak ada upcoming matches.");
        }

        if (Object.keys(finishedData).length > 0) {
            await db.ref("finished_matches").set(finishedData);
            console.log(`Firebase: Sukses update ${Object.keys(finishedData).length} finished matches.`);
        } else {
            console.log("Firebase: Tidak ada finished matches.");
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`=== SELESAI DAILY FIXTURES DALAM ${duration}s ===`);
        process.exit(0);
    } catch (error) {
        console.error("Error fetching daily fixtures:", error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

fetchDailyFixtures();
