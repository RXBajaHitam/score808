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
        const response = await axios.get('https://api.football-data.org/v4/matches?status=IN_PLAY,PAUSED', {
            headers: { 'X-Auth-Token': apiKey }
        });
        
        const matches = response.data.matches;
        
        if (!matches || matches.length === 0) {
            await db.ref("live_matches").set(null);
            return process.exit(0);
        }
        
        const liveScoresData = {};
        matches.forEach(match => {
            liveScoresData[match.id] = {
                league: match.competition.name,
                home_team: match.homeTeam.name,
                home_logo: match.homeTeam.crest || "", // Mapping logo crest
                home_goals: (match.score && match.score.fullTime && match.score.fullTime.home !== null) ? match.score.fullTime.home : 0,
                away_team: match.awayTeam.name,
                away_logo: match.awayTeam.crest || "", // Mapping logo crest
                away_goals: (match.score && match.score.fullTime && match.score.fullTime.away !== null) ? match.score.fullTime.away : 0,
                status: match.status,
                elapsed: match.minute ? match.minute : 0,
                timestamp: new Date(match.utcDate).getTime() 
            };
        });
        
        await db.ref("live_matches").set(liveScoresData);
        process.exit(0);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
updateScores();
