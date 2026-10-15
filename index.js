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

async function fetchLiveFixtures() {
    try {
        const response = await axios.get('https://api.football-data.org/v4/matches?status=LIVE', {
            headers: { 'X-Auth-Token': process.env.API_FOOTBALL_KEY }
        });

        const apiMatches = response.data.matches || [];
        
        const snapshot = await db.ref('matches/live').once('value');
        const currentLiveMatches = snapshot.val() || {};
        
        const priorityLeagueIds = [
            2000, 2001, 2002, 2003, 2013, 2014, 
            2015, 2016, 2017, 2018, 2019, 2021
        ];

        let hasNewLiveMatch = false;
        let newMatchTitle = "";
        let newMatchBody = "";

        const filteredLiveMatches = apiMatches.filter(m => priorityLeagueIds.includes(m.competition.id));

        // Fetch live scoreboard from ESPN if there are live matches
        let espnEvents = [];
        if (filteredLiveMatches.length > 0) {
            try {
                espnEvents = await espnService.fetchEspnScoreboards();
                console.log(`Fetched ${espnEvents.length} ESPN events for live matching`);
            } catch (err) {
                console.warn("ESPN fetch error for live:", err.message);
            }
        }

        const updates = {};

        for (const match of filteredLiveMatches) {
            const leagueName = match.competition.name;
            const matchId = match.id.toString();
            
            if (!currentLiveMatches[matchId]) {
                hasNewLiveMatch = true;
                newMatchTitle = "🔴 Laga Baru Saja Dimulai!";
                newMatchBody = `${match.homeTeam.name} vs ${match.awayTeam.name} (${leagueName})`;
            }

            const matchDetails = espnService.findMatchDetails(match.homeTeam.name, match.awayTeam.name, espnEvents);

            updates[matchId] = {
                id: match.id.toString(),
                league: leagueName,
                home_team: match.homeTeam.name,
                away_team: match.awayTeam.name,
                home_logo: match.homeTeam.crest,
                away_logo: match.awayTeam.crest,
                home_goals: match.score.fullTime.home ?? match.score.halfTime.home ?? 0,
                away_goals: match.score.fullTime.away ?? match.score.halfTime.away ?? 0,
                status: match.status,
                elapsed: 0,
                timestamp: new Date(match.utcDate).getTime(),
                matchDetails: matchDetails || null
            };
        }

        if (Object.keys(updates).length > 0) {
            await Promise.all([
                db.ref('matches/live').set(updates),
                db.ref('live_matches').set(updates)
            ]);
            console.log(`Sukses update ${Object.keys(updates).length} live matches (with matchDetails) ke matches/live dan live_matches`);
        } else {
            await Promise.all([
                db.ref('matches/live').set(null),
                db.ref('live_matches').set(null)
            ]);
            console.log(`Tidak ada laga live saat ini. Data dikosongkan pada kedua node.`);
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
        process.exit(1);
    }
}

fetchLiveFixtures();
