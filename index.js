require('dotenv').config();
const admin = require('firebase-admin');
const axios = require('axios');

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

async function fetchLiveFixtures() {
    try {
        // Menggunakan status=LIVE yang direkomendasikan API v4
        const response = await axios.get('https://api.football-data.org/v4/matches?status=LIVE', {
            headers: { 'X-Auth-Token': process.env.API_FOOTBALL_KEY }
        });

        const apiMatches = response.data.matches || [];
        
        const snapshot = await db.ref('matches/live').once('value');
        const currentLiveMatches = snapshot.val() || {};
        
        const updates = {};
        
        // Menggunakan ID Kompetisi (12 Free Tier)
        const priorityLeagueIds = [
            2000, 2001, 2002, 2003, 2013, 2014, 
            2015, 2016, 2017, 2018, 2019, 2021
        ];

        let hasNewLiveMatch = false;
        let newMatchTitle = "";
        let newMatchBody = "";

        for (const match of apiMatches) {
            const leagueId = match.competition.id;
            const leagueName = match.competition.name;
            
            if (priorityLeagueIds.includes(leagueId)) {
                const matchId = match.id.toString();
                
                if (!currentLiveMatches[matchId]) {
                    hasNewLiveMatch = true;
                    newMatchTitle = "🔴 Laga Baru Saja Dimulai!";
                    newMatchBody = `${match.homeTeam.name} vs ${match.awayTeam.name} (${leagueName})`;
                }

                updates[matchId] = {
                    id: match.id,
                    league: leagueName,
                    home_team: match.homeTeam.name,
                    away_team: match.awayTeam.name,
                    home_logo: match.homeTeam.crest,
                    away_logo: match.awayTeam.crest,
                    home_goals: match.score.fullTime.home ?? match.score.halfTime.home ?? 0,
                    away_goals: match.score.fullTime.away ?? match.score.halfTime.away ?? 0,
                    status: match.status,
                    elapsed: 0,
                    timestamp: new Date(match.utcDate).getTime()
                };
            }
        }

        // Fix: Pastikan object dikirim sebagai null jika tidak ada laga live untuk menghapus node lama
        if (Object.keys(updates).length > 0) {
            await db.ref('matches/live').set(updates);
            console.log(`Sukses update ${Object.keys(updates).length} live matches`);
        } else {
            await db.ref('matches/live').set(null);
            console.log(`Tidak ada laga live saat ini. Data dikosongkan.`);
        }

        if (hasNewLiveMatch) {
            const message = {
                notification: { title: newMatchTitle, body: newMatchBody },
                topic: 'live_matches'
            };
            try {
                await admin.messaging().send(message);
                console.log('Notifikasi terkirim:', newMatchTitle);
            } catch (error) {
                console.error('Gagal mengirim notifikasi:', error);
            }
        }
        
        process.exit(0);

    } catch (error) {
        console.error("Error fetching live matches:", error.response ? error.response.data : error.message);
        process.exit(1); // Ubah jadi 1 agar Github Actions berwarna Merah jika terjadi limit API
    }
}

fetchLiveFixtures();
