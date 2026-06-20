
import { WebSocket } from 'ws';

async function testScenario(scenario, input) {
    console.log(`--- Running Scenario ${scenario.id}: ${scenario.desc} ---`);
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.on('open', () => {
        ws.send(JSON.stringify(input));
    });

    ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        console.log(`Received: ${JSON.stringify(response)}`);
        
        // Basic validation
        if (response.type === 'command' || response.type === 'error') {
            console.log('PASS');
            ws.close();
        } else {
            console.log('FAIL: Unexpected response type');
            ws.close();
        }
    });
}

const scenarios = [
    { id: 1, desc: 'Happy path (EN)', input: { type: 'transcript', text: 'Set AC to 24 degrees', lang: 'en-IN' } },
    { id: 2, desc: 'Hindi command', input: { type: 'transcript', text: 'लाइट चालू करो', lang: 'hi-IN' } },
    { id: 3, desc: 'Telugu command', input: { type: 'transcript', text: 'లైట్ ఆన్ చేయండి', lang: 'te-IN' } }
];

(async () => {
    for (const s of scenarios) {
        await testScenario(s, s.input);
        await new Promise(r => setTimeout(r, 1000));
    }
})();
