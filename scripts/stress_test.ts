// Native fetch used (Node 18+)

const BASE_URL = 'https://psimanager-bay.vercel.app'; // Production URL
const CONCURRENT_REQUESTS = 50;

async function runStressTest() {
    console.log(`🚀 Starting Stress Test: ${CONCURRENT_REQUESTS} concurrent requests...`);
    console.log(`Target: ${BASE_URL}`);

    const startTime = Date.now();

    // Create an array of promises - simple GET to main page or API to check load capacity
    // We avoid POST to not spam the DB with fake data verify-integrity
    const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
        fetch(BASE_URL).then(res => ({ id: i, status: res.status }))
    );

    try {
        const results = await Promise.all(requests);
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        const success = results.filter(r => r.status === 200).length;
        const failures = results.filter(r => r.status !== 200).length;

        console.log('\n📊 Test Results:');
        console.log(`Total Duration: ${duration.toFixed(2)}s`);
        console.log(`Success (200 OK): ${success}`);
        console.log(`Failures: ${failures}`);
        console.log(`Avg Request Time: ${(duration / CONCURRENT_REQUESTS).toFixed(4)}s`);

        if (failures === 0) {
            console.log('\n✅ System PASSED stability test.');
        } else {
            console.log('\n⚠️ System showed some instability.');
        }
    } catch (err) {
        console.error('❌ Test Critical Failure:', err);
    }
}

runStressTest();
