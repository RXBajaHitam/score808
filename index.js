const admin = require('firebase-admin');
const axios = require('axios');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const databaseURL = process.env.FIREBASE_DB_URL;
const apiKey = process.env.API_FOOTBALL_KEY;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: databaseURL
});
const db = admin.database();

async function updateScores() {
    try {
        console.log("Menarik data Live dari football-data.org...");
        // Endpoint difilter khusus untuk pertandingan yang sedang berlangsung / live
        const response = await axios.get('https://api.football-data.org/v4/matches?status=IN_PLAY,PAUSED', {
            headers: { 'X-Auth-Token': apiKey }
        });
        
        const matches = response.data.matches;
        if (!matches || matches.length === 0) {
            console.log("Tidak ada pertandingan live saat ini.");
            return process.exit(0);
        }
        
        const liveScoresData = {};
        matches.forEach(match => {
            liveScoresData[match.id] = {
                league: match.competition.name,
                home_team: match.homeTeam.name,
                home_goals: (match.score && match.score.fullTime && match.score.fullTime.home !== null) ? match.score.fullTime.home : 0,
                away_team: match.awayTeam.name,
                away_goals: (match.score && match.score.fullTime && match.score.fullTime.away !== null) ? match.score.fullTime.away : 0,
                status: match.status, // "IN_PLAY" atau "PAUSED"
                // Catatan: Akun gratis football-data kadang tidak memberikan menit presisi (match.minute). 
                // Kita gunakan fallback ke status (misal "IN_PLAY") jika menit tidak tersedia
                elapsed: match.minute ? match.minute : match.status 
            };
        });
        
        await db.ref("live_matches").set(liveScoresData);
        console.log(`Berhasil update ${Object.keys(liveScoresData).length} data pertandingan live.`);
        process.exit(0);
    } catch (error) {
        console.error("Error fetching live matches:", error.message);
        process.exit(1);
    }
}
updateScores();
