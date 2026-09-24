const admin = require('firebase-admin');
const axios = require('axios');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});
const db = admin.database();

const apiKey = process.env.API_FOOTBALL_KEY;
const headers = { 'X-Auth-Token': apiKey };

// 2021: Premier League, 2014: La Liga, 2019: Serie A, 2002: Bundesliga, 2015: Ligue 1, 2001: UCL
const comps = '2021,2014,2019,2002,2015,2001';

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

async function fetchDailyFixtures() {
    try {
        const todayObj = new Date();
        const todayStr = formatDate(todayObj);
        
        // 10 Hari ke belakang (untuk history)
        const pastDateObj = new Date();
        pastDateObj.setDate(todayObj.getDate() - 10);
        const past10Days = formatDate(pastDateObj);
        
        // 10 Hari ke depan (untuk jadwal)
        const futureDateObj = new Date();
        futureDateObj.setDate(todayObj.getDate() + 10);
        const future10Days = formatDate(futureDateObj);
        
        console.log(`Mengambil Results: ${past10Days} hingga ${todayStr}`);
        const resFinished = await axios.get(`https://api.football-data.org/v4/matches?dateFrom=${past10Days}&dateTo=${todayStr}&competitions=${comps}`, { headers });
        
        console.log(`Mengambil Upcoming: ${todayStr} hingga ${future10Days}`);
        const resUpcoming = await axios.get(`https://api.football-data.org/v4/matches?dateFrom=${todayStr}&dateTo=${future10Days}&competitions=${comps}`, { headers });

        const allMatches = [...(resFinished.data.matches || []), ...(resUpcoming.data.matches || [])];
        
        // Hapus duplikasi jika ada match di hari "today" yang terambil 2 kali
        const uniqueMatchesMap = new Map();
        allMatches.forEach(m => uniqueMatchesMap.set(m.id, m));
        const matches = Array.from(uniqueMatchesMap.values());

        const upcomingData = {};
        const finishedData = {};

        matches.forEach(match => {
            const fixtureId = match.id;
            const status = match.status; 
            
            const matchObj = {
                league: match.competition.name,
                home_team: match.homeTeam.name,
                home_logo: match.homeTeam.crest || "", // Logo
                home_goals: (match.score && match.score.fullTime && match.score.fullTime.home !== null) ? match.score.fullTime.home : 0,
                away_team: match.awayTeam.name,
                away_logo: match.awayTeam.crest || "", // Logo
                away_goals: (match.score && match.score.fullTime && match.score.fullTime.away !== null) ? match.score.fullTime.away : 0,
                status: status,
                timestamp: new Date(match.utcDate).getTime()
            };
            
            if (['SCHEDULED', 'TIMED', 'POSTPONED'].includes(status)) { 
                upcomingData[fixtureId] = matchObj; 
            } 
            else if (['FINISHED', 'AWARDED'].includes(status)) { 
                finishedData[fixtureId] = matchObj; 
            }
        });

        // Update Firebase dan timpa data lama secara paksa
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
