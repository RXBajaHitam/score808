require('dotenv').config();
const admin = require('firebase-admin');
const axios = require('axios');
const espnService = require('./espnService');

let serviceAccount;
try {
  serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : require('./serviceAccountKey.json');
} catch (e) {
  serviceAccount = require('./serviceAccountKey.json');
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});
const db = admin.database();

const apiKey = process.env.API_FOOTBALL_KEY;
const headers = { 'X-Auth-Token': apiKey };

const comps = '2000,2001,2002,2003,2013,2014,2015,2016,2017,2018,2019,2021';

function generateMatchInsights(fixtureId, homeTeam, awayTeam) {
    const seedStr = `${fixtureId}_${homeTeam}_${awayTeam}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
        hash |= 0;
    }
    const positiveHash = Math.abs(hash);
    
    const draw = 20 + (positiveHash % 9);
    const remaining = 100 - draw;
    
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

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

async function fetchDailyFixtures() {
    try {
        const todayObj = new Date();
        const todayStr = formatDate(todayObj);
        
        // 10 Hari ke belakang
        const pastDateObj = new Date();
        pastDateObj.setDate(todayObj.getDate() - 10);
        const past10Days = formatDate(pastDateObj);
        
        // 10 Hari ke depan
        const futureDateObj = new Date();
        futureDateObj.setDate(todayObj.getDate() + 10);
        const future10Days = formatDate(futureDateObj);
        
        console.log(`Mengambil Results: ${past10Days} hingga ${todayStr}`);
        const resFinished = await axios.get(`https://api.football-data.org/v4/matches?dateFrom=${past10Days}&dateTo=${todayStr}&competitions=${comps}`, { headers });
        
        console.log(`Mengambil Upcoming: ${todayStr} hingga ${future10Days}`);
        const resUpcoming = await axios.get(`https://api.football-data.org/v4/matches?dateFrom=${todayStr}&dateTo=${future10Days}&competitions=${comps}`, { headers });

        const allMatches = [...(resFinished.data.matches || []), ...(resUpcoming.data.matches || [])];
        
        const uniqueMatchesMap = new Map();
        allMatches.forEach(m => uniqueMatchesMap.set(m.id, m));
        const matches = Array.from(uniqueMatchesMap.values());

        // Fetch ESPN scoreboards for recent dates (today, yesterday, -2 days, -3 days)
        const recentDates = [];
        for (let i = 0; i <= 3; i++) {
            const d = new Date();
            d.setDate(todayObj.getDate() - i);
            recentDates.push(formatDate(d).replace(/-/g, ''));
        }
        
        console.log(`Mengambil data detail ESPN untuk tanggal: ${recentDates.join(', ')}`);
        const espnDateFetches = recentDates.map(dStr => espnService.fetchEspnScoreboards(dStr));
        const espnDateResults = await Promise.all(espnDateFetches);
        const allEspnEvents = espnDateResults.flat();
        console.log(`Total ${allEspnEvents.length} event ESPN berhasil dimuat untuk enrichment.`);

        const upcomingData = {};
        const finishedData = {};
        let enrichedCount = 0;

        matches.forEach(match => {
            const fixtureId = match.id;
            const status = match.status; 
            
            const insights = generateMatchInsights(fixtureId, match.homeTeam.name, match.awayTeam.name);
            const matchDetails = espnService.findMatchDetails(match.homeTeam.name, match.awayTeam.name, allEspnEvents);
            if (matchDetails) {
                enrichedCount++;
            }

            const matchObj = {
                league: match.competition.name,
                home_team: match.homeTeam.name,
                home_logo: match.homeTeam.crest || "",
                home_goals: (match.score && match.score.fullTime && match.score.fullTime.home !== null) ? match.score.fullTime.home : 0,
                away_team: match.awayTeam.name,
                away_logo: match.awayTeam.crest || "",
                away_goals: (match.score && match.score.fullTime && match.score.fullTime.away !== null) ? match.score.fullTime.away : 0,
                status: status,
                timestamp: new Date(match.utcDate).getTime(),
                insights: insights,
                matchDetails: matchDetails || null
            };
            
            if (['SCHEDULED', 'TIMED', 'POSTPONED'].includes(status)) { 
                upcomingData[fixtureId] = matchObj; 
            } 
            else if (['FINISHED', 'AWARDED'].includes(status)) { 
                finishedData[fixtureId] = matchObj; 
            }
        });

        console.log(`Total pertandingan yang berhasil diperkaya (enriched) dengan detail ESPN: ${enrichedCount}`);

        if (Object.keys(upcomingData).length > 0) {
            await db.ref("upcoming_matches").set(upcomingData);
            console.log(`Berhasil update ${Object.keys(upcomingData).length} jadwal (upcoming).`);
        } else {
            await db.ref("upcoming_matches").set(null);
            console.log("Tidak ada upcoming matches.");
        }
        
        if (Object.keys(finishedData).length > 0) {
            await db.ref("finished_matches").set(finishedData);
            console.log(`Berhasil update ${Object.keys(finishedData).length} hasil (finished).`);
        } else {
            await db.ref("finished_matches").set(null);
            console.log("Tidak ada finished matches.");
        }
        
        process.exit(0);
    } catch (error) {
        console.error("Error fetching daily fixtures:", error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

fetchDailyFixtures();
