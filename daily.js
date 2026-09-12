const admin = require('firebase-admin');
const axios = require('axios');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});
const db = admin.database();

async function fetchDailyFixtures() {
    try {
        console.log("Menarik data jadwal harian...");
        const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
        
        const response = await axios.get(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
            headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
        });

        const matches = response.data.response;
        const upcomingData = {};
        const finishedData = {};

        matches.forEach(match => {
            const fixtureId = match.fixture.id;
            const status = match.fixture.status.short;
            
            const matchObj = {
                league: match.league.name,
                home_team: match.teams.home.name,
                home_logo: match.teams.home.logo,
                home_goals: match.goals.home !== null ? match.goals.home : 0,
                away_team: match.teams.away.name,
                away_logo: match.teams.away.logo,
                away_goals: match.goals.away !== null ? match.goals.away : 0,
                status: status,
                timestamp: match.fixture.timestamp 
            };

            // NS = Not Started, TBD = To Be Defined
            if (['NS', 'TBD', 'PST'].includes(status)) {
                upcomingData[fixtureId] = matchObj;
            } 
            // FT = Full Time, AET = After Extra Time, PEN = Penalties
            else if (['FT', 'AET', 'PEN'].includes(status)) {
                finishedData[fixtureId] = matchObj;
            }
        });

        await db.ref("upcoming_matches").set(upcomingData);
        await db.ref("finished_matches").set(finishedData);
        
        console.log(`Sukses: ${Object.keys(upcomingData).length} Upcoming, ${Object.keys(finishedData).length} Finished.`);
        process.exit(0);
    } catch (error) {
        console.error("Gagal menarik jadwal harian:", error);
        process.exit(1);
    }
}

fetchDailyFixtures();
