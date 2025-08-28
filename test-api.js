async function testFrontendAPI() {
    const frontendUrl = 'http://localhost:3009';
    
    console.log('Testing frontend API connectivity...');
    
    try {
        // Test 1: Get workstations
        console.log('\n1. Testing /api/workstations...');
        const wsResponse = await fetch(`${frontendUrl}/api/workstations`);
        console.log(`Status: ${wsResponse.status} ${wsResponse.statusText}`);
        
        if (wsResponse.ok) {
            const wsData = await wsResponse.json();
            console.log(`Found ${wsData.workstations?.length || 0} workstations`);
            if (wsData.workstations?.length > 0) {
                console.log('First workstation:', wsData.workstations[0].workstationId, wsData.workstations[0].name);
            }
        } else {
            console.log('Failed to get workstations');
        }

        // Test 2: Get M1 workstation devices  
        console.log('\n2. Testing /api/workstation/M1/devices...');
        const devResponse = await fetch(`${frontendUrl}/api/workstation/M1/devices`);
        console.log(`Status: ${devResponse.status} ${devResponse.statusText}`);
        
        if (devResponse.ok) {
            const devData = await devResponse.json();
            console.log(`Found ${devData.devices?.length || 0} devices for workstation M1`);
            if (devData.devices?.length > 0) {
                console.log('Devices:');
                devData.devices.forEach(d => {
                    console.log(`  - ${d.name} (${d.deviceId}) - ${d.ipAddress}:${d.port}`);
                });
            }
        } else {
            console.log('Failed to get workstation devices');
        }

    } catch (error) {
        console.error('API test error:', error.message);
    }
}

testFrontendAPI();