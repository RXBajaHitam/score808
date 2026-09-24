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
        const todayObj = new Date();
        const today = todayObj.toISOString().split('T')[0];
        const pastDateObj = new Date();
        pastDateObj.setDate(todayObj.getDate() - 7);
        const past7Days = pastDateObj.toISOString().split('T')[0];
        
        // 2021 adalah ID kompetisi untuk Premier League di football-data.org (setara dengan league=39 di API-Sports)
        // Gunakan dateFrom dan dateTo sebagai format parameter filter tanggal
        const response = await axios.get(`https://api.football-data.org/v4/matches?dateFrom=${past7Days}&dateTo=${today}&competitions=2021`, {
            headers: { 'X-Auth-Token': process.env.API_FOOTBALL_KEY }
        });

        const matches = response.data.matches;
        if (!matches || matches.length === 0) {
            console.log("Tidak ada jadwal/hasil yang didapat dari range waktu tersebut.");
            return process.exit(0);
        }

        const upcomingData = {};
        const finishedData = {};

        matches.forEach(match => {
            const fixtureId = match.id;
            const status = match.status; 
            
            const matchObj = {
                league: match.competition.name,
                home_team: match.homeTeam.name,
                home_goals: (match.score && match.score.fullTime && match.score.fullTime.home !== null) ? match.score.fullTime.home : 0,
                away_team: match.awayTeam.name,
                away_goals: (match.score && match.score.fullTime && match.score.fullTime.away !== null) ? match.score.fullTime.away : 0,
                status: status
            };
            
            // Pengelompokan berdasarkan status terbaru football-data.org
            if (['SCHEDULED', 'TIMED', 'POSTPONED'].includes(status)) { 
                upcomingData[fixtureId] = matchObj; 
            } 
            else if (['FINISHED', 'AWARDED'].includes(status)) { 
                finishedData[fixtureId] = matchObj; 
            }
        });

        if (Object.keys(upcomingData).length > 0) {
            await db.ref("upcoming_matches").update(upcomingData);
            console.log(`Update ${Object.keys(upcomingData).length} jadwal (upcoming).`);
        }
        
        if (Object.keys(finishedData).length > 0) {
            await db.ref("finished_matches").update(finishedData);
            console.log(`Update ${Object.keys(finishedData).length} hasil (finished).`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error("Error fetching daily fixtures:", error.message);
        process.exit(1);
    }
}
fetchDailyFixtures();
