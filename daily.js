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
        console.log("Menarik data jadwal dan hasil 7 hari terakhir...");
        
        // Kalkulasi rentang tanggal
        const todayObj = new Date();
        const today = todayObj.toISOString().split('T')[0]; // Format YYYY-MM-DD untuk hari ini
        
        const pastDateObj = new Date();
        pastDateObj.setDate(todayObj.getDate() - 7);
        const past7Days = pastDateObj.toISOString().split('T')[0]; // Format YYYY-MM-DD untuk H-7
        
        // Memanggil API dengan parameter lengkap
        const response = await axios.get(`https://v3.football.api-sports.io/fixtures`, {
            headers: { 
                'x-apisports-key': process.env.API_FOOTBALL_KEY 
            },
            params: {
                from: past7Days,
                to: today,
                league: 39,      // Testing: Hanya tarik English Premier League
                season: 2024,    // Wajib diisi jika menggunakan filter 'league'
                timezone: 'Asia/Jakarta'
            }
        });

        // CEK PESAN ERROR TERSEMBUNYI DARI API-SPORTS
        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error("API-SPORTS ERROR DETECTED:");
            console.error(response.data.errors);
            console.error("Script dihentikan agar tidak menghapus data Firebase dengan data kosong.");
            process.exit(1); // Exit code 1 membuat GitHub Actions mendeteksi ini sebagai "Failed"
        }

        const matches = response.data.response;
        
        if (!matches || matches.length === 0) {
            console.warn("Tidak ada error, tapi API mengembalikan array kosong (0 pertandingan).");
        }

        const upcomingData = {};
        const finishedData = {};

        matches.forEach(match => {
            const fixtureId = match.fixture.id;
            const status = match.fixture.status.short;
            
            const matchObj = {
                league: match.league.country + " - " + match.league.name,
                home_team: match.teams.home.name,
                home_logo: match.teams.home.logo,
                home_goals: match.goals.home !== null ? match.goals.home : 0,
                away_team: match.teams.away.name,
                away_logo: match.teams.away.logo,
                away_goals: match.goals.away !== null ? match.goals.away : 0,
                status: status,
                timestamp: match.fixture.timestamp 
            };

            // NS = Not Started, TBD = To Be Defined, PST = Postponed
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
        
        console.log(`Sukses menyimpan ke Firebase: ${Object.keys(upcomingData).length} Upcoming, ${Object.keys(finishedData).length} Finished.`);
        process.exit(0);
    } catch (error) {
        console.error("Gagal menarik data jadwal/hasil:", error.message);
        if (error.response) {
            console.error("Detail Error API:", error.response.data);
        }
        process.exit(1);
    }
}

fetchDailyFixtures();
