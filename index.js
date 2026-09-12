const admin = require('firebase-admin');
const axios = require('axios');

// Mengambil rahasia dari brankas GitHub
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
        console.log("Menarik data dari API-Football...");
        const response = await axios.get('https://v3.football.api-sports.io/fixtures?live=all', {
            headers: { 'x-apisports-key': apiKey }
        });

        const matches = response.data.response;
        if (!matches || matches.length === 0) {
            console.log("Tidak ada pertandingan live.");
            return process.exit(0);
        }

        const liveScoresData = {};
        matches.forEach(match => {
            liveScoresData[match.fixture.id] = {
                league: match.league.country + " - " + match.league.name,
                home_team: match.teams.home.name,
                home_logo: match.teams.home.logo, // Menarik URL Logo Tim Kandang
                home_goals: match.goals.home !== null ? match.goals.home : 0,
                away_team: match.teams.away.name,
                away_logo: match.teams.away.logo, // Menarik URL Logo Tim Tandang
                away_goals: match.goals.away !== null ? match.goals.away : 0,
                status: match.fixture.status.short,
                elapsed: match.fixture.status.elapsed,
                last_update: admin.database.ServerValue.TIMESTAMP
            };
        });

        await db.ref("live_matches").set(liveScoresData);
        console.log(`Berhasil update ${matches.length} pertandingan beserta logo ke Firebase.`);
        process.exit(0);
    } catch (error) {
        console.error("Gagal:", error);
        process.exit(1);
    }
}

updateScores();
