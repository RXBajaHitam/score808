require('dotenv').config({ path: '/root/score808/.env' });
const admin = require('firebase-admin');
const axios = require('axios');
const espnService = require('./espnService');

let serviceAccount;
try {
  serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : require('./serviceAccountKey.json');
} catch (e) {
  serviceAccount = require('./serviceAccountKey.json');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL || 'https://score808-59356-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}
const db = admin.database();

async function runSmartLivePolling() {
    console.log(`=== SMART LIVE POLLING (1-MIN CRON) ===`);
    const startTime = Date.now();
    try {
        const now = Date.now();
        
        // 1. Read current state from Firebase
        const [liveSnap, upcomingSnap] = await Promise.all([
            db.ref('matches/live').once('value'),
            db.ref('upcoming_matches').once('value')
        ]);

        const currentLiveMatches = liveSnap.val() || {};
        const upcomingMatches = upcomingSnap.val() || {};

        const activeSlugs = new Set();

        // 2. Scan upcoming matches in active kickoff window:
        // Match was supposed to kick off between 15 mins from now and 150 mins ago (2.5 hours)
        const KICKOFF_WINDOW_BEFORE = 150 * 60 * 1000; // 2.5 hours ago
        const KICKOFF_WINDOW_AFTER = 15 * 60 * 1000;   // 15 mins in future

        Object.values(upcomingMatches).forEach(m => {
            if (m && m.timestamp) {
                const diff = now - m.timestamp;
                if (m.timestamp <= now + KICKOFF_WINDOW_AFTER && m.timestamp >= now - KICKOFF_WINDOW_BEFORE) {
                    const slug = m.league_slug || espnService.findSlugByLeagueName(m.league);
                    if (slug) activeSlugs.add(slug);
                }
            }
        });

        // 3. Scan currently live matches
        Object.values(currentLiveMatches).forEach(m => {
            if (m) {
                const slug = m.league_slug || espnService.findSlugByLeagueName(m.league);
                if (slug) activeSlugs.add(slug);
            }
        });

        console.log(`[Smart Polling] Liga kandidat aktif terdeteksi: ${activeSlugs.size} (${Array.from(activeSlugs).join(', ') || 'tidak ada'})`);

        // Check football-data.org LIVE matches if API key is present
        let fdLiveMatches = [];
        if (process.env.API_FOOTBALL_KEY) {
            try {
                const fdRes = await axios.get('https://api.football-data.org/v4/matches?status=LIVE', {
                    headers: { 'X-Auth-Token': process.env.API_FOOTBALL_KEY },
                    timeout: 4000
                });
                fdLiveMatches = fdRes.data.matches || [];
                if (fdLiveMatches.length > 0) {
                    console.log(`[FD.org] Ditemukan ${fdLiveMatches.length} live matches dari football-data.org`);
                    fdLiveMatches.forEach(m => {
                        const slug = espnService.getLeagueByFootballDataId(m.competition.id)?.slug || espnService.findSlugByLeagueName(m.competition.name);
                        if (slug) activeSlugs.add(slug);
                    });
                }
            } catch (err) {
                // Ignore timeout or rate limit
            }
        }

        const updates = {};
        let hasNewLiveMatch = false;
        let newMatchTitle = "";
        let newMatchBody = "";

        // 4. If we have active slugs, poll ESPN ONLY for those slugs!
        if (activeSlugs.size > 0) {
            console.log(`[Smart Polling] Mengambil data ESPN HANYA untuk ${activeSlugs.size} liga aktif: ${Array.from(activeSlugs).join(', ')}`);
            const espnResults = await espnService.fetchEspnScoreboardsBatched(Array.from(activeSlugs), null, 3, 100);

            for (const res of espnResults) {
                const rawEvents = res.rawEvents || [];
                for (const ev of rawEvents) {
                    const state = ev.status?.type?.state;
                    // If match is currently in progress
                    if (state === 'in') {
                        const mapped = espnService.espnEventToFirebaseMatch(ev, res.leagueConfig);
                        if (mapped) {
                            const matchId = mapped.id;
                            if (!currentLiveMatches[matchId]) {
                                hasNewLiveMatch = true;
                                newMatchTitle = "🔴 Laga Baru Saja Dimulai!";
                                newMatchBody = `${mapped.home_team} vs ${mapped.away_team} (${mapped.league})`;
                            }
                            updates[matchId] = mapped;
                        }
                    }
                }
            }
        }

        // 5. Also merge any football-data live matches (if not already captured by ESPN)
        if (fdLiveMatches.length > 0) {
            for (const match of fdLiveMatches) {
                const matchId = match.id.toString();
                // Check if already captured in updates
                const alreadyCaptured = Object.values(updates).some(u => 
                    espnService.teamsMatch(u.home_team, match.homeTeam.name) && 
                    espnService.teamsMatch(u.away_team, match.awayTeam.name)
                );

                if (!alreadyCaptured) {
                    if (!currentLiveMatches[matchId]) {
                        hasNewLiveMatch = true;
                        newMatchTitle = "🔴 Laga Baru Saja Dimulai!";
                        newMatchBody = `${match.homeTeam.name} vs ${match.awayTeam.name} (${match.competition.name})`;
                    }

                    const leagueConfig = espnService.getLeagueByFootballDataId(match.competition.id);
                    const leagueSlug = leagueConfig?.slug || espnService.findSlugByLeagueName(match.competition.name) || "";
                    const insights = espnService.generateMatchInsights(matchId, match.homeTeam.name, match.awayTeam.name);

                    updates[matchId] = {
                        id: matchId,
                        league: match.competition.name,
                        league_slug: leagueSlug,
                        home_team: match.homeTeam.name,
                        away_team: match.awayTeam.name,
                        home_logo: match.homeTeam.crest || "",
                        away_logo: match.awayTeam.crest || "",
                        home_goals: match.score.fullTime.home ?? match.score.halfTime.home ?? 0,
                        away_goals: match.score.fullTime.away ?? match.score.halfTime.away ?? 0,
                        status: match.status,
                        elapsed: 0,
                        timestamp: new Date(match.utcDate).getTime(),
                        utcDate: match.utcDate,
                        tv: leagueConfig ? leagueConfig.defaultTv : '',
                        insights: insights,
                        matchDetails: null
                    };
                }
            }
        }

        // 6. Dual-write to Firebase nodes matches/live AND live_matches
        if (Object.keys(updates).length > 0) {
            await Promise.all([
                db.ref('matches/live').set(updates),
                db.ref('live_matches').set(updates)
            ]);
            console.log(`Firebase: Sukses update ${Object.keys(updates).length} live matches ke matches/live dan live_matches`);
        } else {
            // Only write null if previously there were matches, to avoid unnecessary writes
            if (Object.keys(currentLiveMatches).length > 0) {
                await Promise.all([
                    db.ref('matches/live').set(null),
                    db.ref('live_matches').set(null)
                ]);
                console.log(`Firebase: Pertandingan selesai, node live dikosongkan.`);
            } else {
                console.log(`Firebase: Tidak ada laga live saat ini.`);
            }
        }

        // 7. Send FCM Notification if new match kicked off
        if (hasNewLiveMatch) {
            const message = {
                notification: { title: newMatchTitle, body: newMatchBody },
                topic: 'live_matches'
            };
            try {
                await admin.messaging().send(message);
                console.log(`FCM Notifikasi terkirim: ${newMatchTitle} - ${newMatchBody}`);
            } catch (error) {
                console.error(`FCM gagal kirim notifikasi:`, error.message);
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`=== SMART POLLING SELESAI DALAM ${duration}s ===`);
        process.exit(0);

    } catch (error) {
        console.error("Error in smart live polling:", error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

runSmartLivePolling();
