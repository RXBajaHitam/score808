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
        
        // Ambil dari 3 hari ke belakang (untuk results)
        const pastDateObj = new Date();
        pastDateObj.setDate(todayObj.getDate() - 3);
        const past3Days = pastDateObj.toISOString().split('T')[0];
        
        // Ambil sampai 7 hari ke depan (untuk jadwal/upcoming)
        // Maksimal rentang API gratis adalah 10 hari
        const futureDateObj = new Date();
        futureDateObj.setDate(todayObj.getDate() + 7);
        const future7Days = futureDateObj.toISOString().split('T')[0];
        
        console.log(`Mengambil data dari ${past3Days} hingga ${future7Days}`);
        
        // Endpoint utama football-data (seluruh liga gratis)
        const response = await axios.get(`https://api.football-data.org/v4/matches?dateFrom=${past3Days}&dateTo=${future7Days}`, {
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
                home_logo: match.homeTeam.crest || "", // Mengambil gambar logo tim Home
                home_goals: (match.score && match.score.fullTime && match.score.fullTime.home !== null) ? match.score.fullTime.home : 0,
                away_team: match.awayTeam.name,
                away_logo: match.awayTeam.crest || "", // Mengambil gambar logo tim Away
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

        // Simpan Data Upcoming
        if (Object.keys(upcomingData).length > 0) {
            await db.ref("upcoming_matches").set(upcomingData);
            console.log(`Berhasil update ${Object.keys(upcomingData).length} jadwal (upcoming).`);
        } else {
            await db.ref("upcoming_matches").set(null);
        }
        
        // Simpan Data Finished
        if (Object.keys(finishedData).length > 0) {
            await db.ref("finished_matches").set(finishedData);
            console.log(`Berhasil update ${Object.keys(finishedData).length} hasil (finished).`);
        } else {
            await db.ref("finished_matches").set(null);
        }
        
        process.exit(0);
    } catch (error) {
        console.error("Error fetching daily fixtures:", error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

fetchDailyFixtures();
