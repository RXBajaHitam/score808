const admin = require('firebase-admin');
const axios = require('axios');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});
const db = admin.database();

async function fetchLiveFixtures() {
    try {
        const response = await axios.get('https://api.football-data.org/v4/matches?status=IN_PLAY,PAUSED', {
            headers: { 'X-Auth-Token': process.env.API_FOOTBALL_KEY }
        });

        const apiMatches = response.data.matches || [];
        
        // Fetch current live matches from Firebase to compare states
        const snapshot = await db.ref('matches/live').once('value');
        const currentLiveMatches = snapshot.val() || {};
        
        const updates = {};
        const priorityLeagues = [
            "UEFA Champions League", "Premier League", "Primera Division",
            "Serie A", "Bundesliga", "Ligue 1", "Campeonato Brasileiro Série A",
            "Eredivisie", "Primeira Liga", "Championship"
        ];

        let hasNewLiveMatch = false;
        let newMatchTitle = "";
        let newMatchBody = "";

        for (const match of apiMatches) {
            const leagueName = match.competition.name;
            
            if (priorityLeagues.includes(leagueName)) {
                const matchId = match.id.toString();
                
                // If this match wasn't in Firebase live matches previously, it JUST started!
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

        await db.ref('matches/live').set(updates);
        console.log(`Sukses update ${Object.keys(updates).length} live matches`);

        // Send Push Notification if a new match started
        if (hasNewLiveMatch) {
            const message = {
                notification: {
                    title: newMatchTitle,
                    body: newMatchBody
                },
                topic: 'live_matches'
            };
            try {
                await admin.messaging().send(message);
                console.log('Notifikasi terkirim:', newMatchTitle);
            } catch (error) {
                console.error('Gagal mengirim notifikasi:', error);
            }
        }

    } catch (error) {
        console.error("Error fetching live matches:", error.message);
    } finally {
        process.exit(0);
    }
}

fetchLiveFixtures();

